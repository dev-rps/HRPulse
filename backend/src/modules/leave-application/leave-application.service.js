'use strict';

const prisma = require('../../lib/prisma');
const { getIO } = require('../../sockets');

/**
 * Calculate calendar days between two dates (inclusive).
 */
function countDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Strip time for day counting
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Fetch employee's own leave requests.
 */
async function getMyLeaveRequests(userId) {
  return prisma.leaveRequest.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Fetch employee's own leave balances.
 */
async function getMyLeaveBalances(userId) {
  const year = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { user_id: userId, year },
  });

  // Ensure default structures are returned if not seeded
  const leaveTypes = ['paid', 'sick', 'unpaid'];
  const results = leaveTypes.map((type) => {
    const existing = balances.find((b) => b.leave_type === type);
    if (existing) {
      return {
        leave_type: type,
        total_days: existing.total_days,
        used_days: existing.used_days,
        remaining_days: type === 'unpaid' ? Infinity : existing.total_days - existing.used_days,
      };
    }
    
    // Default allocations
    const defaults = { paid: 20, sick: 10, unpaid: 999 };
    return {
      leave_type: type,
      total_days: defaults[type],
      used_days: 0,
      remaining_days: type === 'unpaid' ? Infinity : defaults[type],
    };
  });

  return results;
}

/**
 * Submit a new leave request with comprehensive validation.
 */
async function submitLeaveRequest(userId, body) {
  const { leave_type, start_date, end_date, remarks } = body;

  // Basic validations
  if (!leave_type || !start_date || !end_date) {
    const err = new Error('Missing required fields: leave_type, start_date, end_date');
    err.statusCode = 400;
    throw err;
  }

  if (!['paid', 'sick', 'unpaid'].includes(leave_type)) {
    const err = new Error('Invalid leave_type. Must be paid, sick, or unpaid.');
    err.statusCode = 400;
    throw err;
  }

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    const err = new Error('Invalid start_date or end_date format.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Validate: end_date >= start_date
  if (endDate < startDate) {
    const err = new Error('End date must be on or after the start date.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate: Cannot be in the past (except for sick leave)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const testStartDate = new Date(startDate);
  testStartDate.setHours(0, 0, 0, 0);

  if (leave_type !== 'sick' && testStartDate < today) {
    const err = new Error('Leave request start date cannot be in the past for paid or unpaid leave.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate: No overlapping pending or approved requests
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      user_id: userId,
      status: { in: ['pending', 'approved'] },
      start_date: { lte: endDate },
      end_date: { gte: startDate },
    },
  });

  if (overlap) {
    const format = (d) => d.toISOString().split('T')[0];
    const err = new Error(
      `Overlapping request exists: you already have a ${overlap.status} leave request from ${format(overlap.start_date)} to ${format(overlap.end_date)}.`
    );
    err.statusCode = 409;
    throw err;
  }

  // 4. Validate: Leave balance check
  const requestedDays = countDays(startDate, endDate);
  const year = startDate.getFullYear();

  if (leave_type !== 'unpaid') {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_type_year: {
          user_id: userId,
          leave_type,
          year,
        },
      },
    });

    const totalDays = balance ? balance.total_days : (leave_type === 'paid' ? 20 : 10);
    const usedDays = balance ? balance.used_days : 0;
    const remaining = totalDays - usedDays;

    if (requestedDays > remaining) {
      const err = new Error(
        `Insufficient leave balance. Requested ${requestedDays} days but only ${remaining} remaining for ${leave_type} leave.`
      );
      err.statusCode = 422;
      throw err;
    }
  }

  // Save the request
  const request = await prisma.leaveRequest.create({
    data: {
      user_id: userId,
      leave_type,
      start_date: startDate,
      end_date: endDate,
      remarks: remarks || null,
      status: 'pending',
    },
  });

  // Socket notification
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(`notification:new:${userId}`, {
      id: request.id,
      type: 'LEAVE_SUBMITTED',
      message: `Your ${leave_type} leave request from ${start_date.split('T')[0]} to ${end_date.split('T')[0]} has been submitted.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Ignore socket error in test context
  }

  return request;
}

module.exports = {
  getMyLeaveRequests,
  getMyLeaveBalances,
  submitLeaveRequest,
};
