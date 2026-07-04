'use strict';

/**
 * Leave Approval Service — business logic layer.
 *
 * Key design decisions:
 *   1. RBAC is enforced at the route level (requireRole middleware), but the
 *      service also applies data-scoping rules (employees see only their own).
 *   2. Team capacity check is a WARNING payload, not a hard block — the admin
 *      dashboard can render it as a caution banner before final confirmation.
 *   3. Every decision writes an audit_log row regardless of warning state.
 *   4. Socket.io emit happens AFTER the DB transaction commits — consistency
 *      over real-time immediacy (a failed DB write won't emit a false update).
 */

const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { getIO } = require('../../sockets');

// ─── Zod schema for the decision endpoint body ────────────────────────────────

const decisionSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'status must be "approved" or "rejected"' }),
  }),
  comment: z.string().max(500).optional().nullable(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate calendar days between two dates (inclusive).
 */
function countDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Team capacity check.
 *
 * Counts how many OTHER employees in the same department already have
 * APPROVED leave overlapping the requested date range.
 *
 * Returns a warning object if overlap exists, null otherwise.
 *
 * @param {string} department
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} excludeRequestId - the request being decided (exclude self)
 * @returns {Promise<{warning: boolean, capacityMessage: string}|null>}
 */
async function checkTeamCapacity(department, startDate, endDate, excludeRequestId) {
  if (!department) return null;

  // Total employees in department
  const totalInDept = await prisma.user.count({
    where: { department },
  });

  if (totalInDept <= 1) return null; // Only one person — no capacity concern

  // Approved leaves in the same department overlapping this date range
  const overlappingCount = await prisma.leaveRequest.count({
    where: {
      id: { not: excludeRequestId },
      status: 'approved',
      user: { department },
      AND: [
        { start_date: { lte: endDate } },
        { end_date: { gte: startDate } },
      ],
    },
  });

  if (overlappingCount === 0) return null;

  return {
    warning: true,
    capacityMessage: `${overlappingCount} of ${totalInDept} team members already have approved leave overlapping these dates`,
  };
}

// ─── Get Leave Requests ───────────────────────────────────────────────────────

/**
 * Admin: returns all leave requests with requester info.
 * Employee: returns only their own requests.
 *
 * @param {object} requestingUser - from req.user (set by requireAuth)
 * @param {object} filters - { status, year } optional query params
 */
async function getLeaveRequests(requestingUser, filters = {}) {
  const { status, year } = filters;

  const where = {};

  // Data scoping — employees can only see their own
  if (requestingUser.role === 'employee') {
    where.user_id = requestingUser.id;
  }

  if (status) {
    where.status = status;
  }

  if (year) {
    const yearInt = parseInt(year, 10);
    where.start_date = {
      gte: new Date(`${yearInt}-01-01`),
      lte: new Date(`${yearInt}-12-31`),
    };
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          employee_id: true,
          department: true,
          job_title: true,
          profile_picture_url: true,
        },
      },
      approver: {
        select: { id: true, name: true, employee_id: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return requests;
}

// ─── Submit Leave Request ─────────────────────────────────────────────────────

const submitSchema = z.object({
  leave_type: z.enum(['paid', 'sick', 'unpaid']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  remarks: z.string().max(500).optional().nullable(),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  { message: 'end_date must be on or after start_date', path: ['end_date'] }
);

async function submitLeaveRequest(userId, body) {
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details = parsed.error.flatten().fieldErrors;
    throw err;
  }

  const { leave_type, start_date, end_date, remarks } = parsed.data;
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const days = countDays(startDate, endDate);

  // Optional: check leave balance before submitting
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      user_id_leave_type_year: {
        user_id: userId,
        leave_type,
        year: startDate.getFullYear(),
      },
    },
  });

  if (balance) {
    const remaining = balance.total_days - balance.used_days;
    if (leave_type !== 'unpaid' && days > remaining) {
      const err = new Error(
        `Insufficient leave balance. Requested ${days} days but only ${remaining} remaining.`
      );
      err.statusCode = 422;
      throw err;
    }
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      user_id: userId,
      leave_type,
      start_date: startDate,
      end_date: endDate,
      remarks: remarks ?? null,
      status: 'pending',
    },
    include: {
      user: {
        select: { id: true, name: true, employee_id: true, department: true },
      },
    },
  });

  // Notify the employee their request was received
  try {
    getIO().to(`user:${userId}`).emit(`notification:new:${userId}`, {
      id: leaveRequest.id,
      type: 'LEAVE_SUBMITTED',
      message: `Your ${leave_type} leave request from ${start_date.slice(0, 10)} to ${end_date.slice(0, 10)} has been submitted.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Socket.io not initialized yet in tests — don't crash
  }

  return leaveRequest;
}

// ─── Make Decision ────────────────────────────────────────────────────────────

/**
 * Approve or reject a leave request.
 *
 * Returns:
 *   { data: updatedRequest, warning?: boolean, capacityMessage?: string }
 *
 * The `warning` block is present when other team members have approved
 * leave overlapping this date range. It is informational only — the admin
 * can still approve. The frontend should render it as a caution banner.
 */
async function makeDecision(requestId, body, actingAdmin) {
  // ── Validate input ────────────────────────────────────────────────────────
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details = parsed.error.flatten().fieldErrors;
    throw err;
  }

  const { status, comment } = parsed.data;

  // ── Fetch request + requesting user ───────────────────────────────────────
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: { id: true, name: true, department: true, employee_id: true },
      },
    },
  });

  if (!leaveRequest) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    throw err;
  }

  if (leaveRequest.status !== 'pending') {
    const err = new Error(
      `Cannot update a request that is already ${leaveRequest.status}`
    );
    err.statusCode = 409;
    throw err;
  }

  // ── Team capacity check (approval only) ───────────────────────────────────
  let capacityWarning = null;
  if (status === 'approved') {
    capacityWarning = await checkTeamCapacity(
      leaveRequest.user.department,
      leaveRequest.start_date,
      leaveRequest.end_date,
      requestId
    );
  }

  // ── Update leave request + write audit log (atomic transaction) ───────────
  const [updatedRequest] = await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status,
        approved_by: actingAdmin.id,
        admin_comment: comment ?? null,
        updated_at: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true,
            department: true,
            job_title: true,
          },
        },
        approver: {
          select: { id: true, name: true, employee_id: true },
        },
      },
    }),

    prisma.auditLog.create({
      data: {
        actor_id: actingAdmin.id,
        action: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        entity: 'leave_requests',
        entity_id: requestId,
      },
    }),
  ]);

  // ── Update leave balance if approved ──────────────────────────────────────
  if (status === 'approved') {
    const days = countDays(leaveRequest.start_date, leaveRequest.end_date);
    const year = leaveRequest.start_date.getFullYear();

    // Upsert balance row — increment used_days (create if not exists)
    await prisma.leaveBalance.upsert({
      where: {
        user_id_leave_type_year: {
          user_id: leaveRequest.user_id,
          leave_type: leaveRequest.leave_type,
          year,
        },
      },
      update: { used_days: { increment: days } },
      create: {
        user_id: leaveRequest.user_id,
        leave_type: leaveRequest.leave_type,
        total_days: 20, // Default allocation — admin can adjust via separate endpoint
        used_days: days,
        year,
      },
    });
  }

  // ── Emit real-time event to the requesting employee ───────────────────────
  const socketPayload = {
    requestId: updatedRequest.id,
    status: updatedRequest.status,
    comment: updatedRequest.admin_comment,
    updatedAt: updatedRequest.updated_at.toISOString(),
  };

  try {
    const io = getIO();
    // Emit to the employee's personal room
    io.to(`user:${leaveRequest.user_id}`).emit(
      `leave:status:${leaveRequest.user_id}`,
      socketPayload
    );
    console.log(
      `[SOCKET] Emitted leave:status:${leaveRequest.user_id} → ${status}`
    );
  } catch (socketErr) {
    // Log but don't fail the HTTP request if socket emit errors
    console.error('[SOCKET] Emit failed:', socketErr.message);
  }

  // ── Build response ────────────────────────────────────────────────────────
  const response = { data: updatedRequest };

  if (capacityWarning) {
    response.warning = capacityWarning.warning;
    response.capacityMessage = capacityWarning.capacityMessage;
  }

  return response;
}

// ─── Cancel Request (employee self-cancel) ────────────────────────────────────

async function cancelLeaveRequest(requestId, userId) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
  });

  if (!leaveRequest) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    throw err;
  }

  if (leaveRequest.user_id !== userId) {
    const err = new Error('You can only cancel your own leave requests');
    err.statusCode = 403;
    throw err;
  }

  if (leaveRequest.status !== 'pending') {
    const err = new Error('Only pending requests can be cancelled');
    err.statusCode = 409;
    throw err;
  }

  await prisma.leaveRequest.delete({ where: { id: requestId } });

  return { message: 'Leave request cancelled successfully' };
}

module.exports = {
  getLeaveRequests,
  submitLeaveRequest,
  makeDecision,
  cancelLeaveRequest,
};
