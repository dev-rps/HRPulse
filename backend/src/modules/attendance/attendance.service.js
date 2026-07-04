'use strict';

const prisma = require('../../lib/prisma');
const { getIO } = require('../../sockets');

// Cutoff configuration (default 10:00 AM)
const CUTOFF_TIME = process.env.ATTENDANCE_CUTOFF || '10:00';

/**
 * Get date and time details formatted for the Asia/Kolkata timezone.
 * Enforces consistency between server and client times.
 * 
 * @param {string|Date} timestamp - The client check-in/out timestamp
 * @returns {{ hour: number, minute: number, dateStr: string }}
 */
function getLocalTimeDetails(timestamp) {
  const dt = new Date(timestamp);
  
  // Extract date in YYYY-MM-DD format in Asia/Kolkata timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = dateFormatter.format(dt); // returns YYYY-MM-DD
  
  // Extract time parts in Asia/Kolkata timezone
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = timeFormatter.formatToParts(dt);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);

  return { hour, minute, dateStr };
}

/**
 * Determine attendance status based on the check-in time of day.
 * 
 * @param {number} hour 
 * @param {number} minute 
 * @returns {'present'|'half_day'}
 */
function determineStatus(hour, minute) {
  const [cutoffHour, cutoffMinute] = CUTOFF_TIME.split(':').map(Number);
  
  if (hour < cutoffHour) {
    return 'present';
  } else if (hour === cutoffHour && minute <= cutoffMinute) {
    return 'present';
  } else {
    return 'half_day';
  }
}

/**
 * Record a check-in for the current user.
 * 
 * @param {string} userId 
 * @param {{ timestamp: string, synced_offline?: boolean }} body 
 */
async function checkIn(userId, body) {
  const timestamp = body.timestamp || new Date().toISOString();
  const synced_offline = body.synced_offline || false;
  
  const { hour, minute, dateStr } = getLocalTimeDetails(timestamp);
  const dateMidnight = new Date(dateStr + 'T00:00:00.000Z');

  // Check if a record already exists for the user on this date
  const existingRecord = await prisma.attendance.findUnique({
    where: {
      user_id_date: {
        user_id: userId,
        date: dateMidnight,
      },
    },
  });

  if (existingRecord) {
    const error = new Error('Already checked in for today.');
    error.statusCode = 409;
    throw error;
  }

  const status = determineStatus(hour, minute);

  // Write record to database
  const record = await prisma.attendance.create({
    data: {
      user_id: userId,
      date: dateMidnight,
      check_in_time: new Date(timestamp),
      status,
      synced_offline,
    },
    include: {
      user: {
        select: {
          id: true,
          employee_id: true,
          name: true,
          department: true,
          job_title: true,
        },
      },
    },
  });

  // Emit real-time Socket.io updates
  await emitAttendanceUpdate(userId, record, dateStr);

  return record;
}

/**
 * Record a check-out for the current date.
 * 
 * @param {string} userId 
 * @param {{ timestamp: string, synced_offline?: boolean }} body 
 */
async function checkOut(userId, body) {
  const timestamp = body.timestamp || new Date().toISOString();
  const synced_offline = body.synced_offline || false;

  const { dateStr } = getLocalTimeDetails(timestamp);
  const dateMidnight = new Date(dateStr + 'T00:00:00.000Z');

  // Find existing record
  const record = await prisma.attendance.findUnique({
    where: {
      user_id_date: {
        user_id: userId,
        date: dateMidnight,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          employee_id: true,
          name: true,
          department: true,
          job_title: true,
        },
      },
    },
  });

  if (!record) {
    const error = new Error('No check-in record found for today. Please check in first.');
    error.statusCode = 400;
    throw error;
  }

  if (record.check_out_time) {
    const error = new Error('Already checked out for today.');
    error.statusCode = 400;
    throw error;
  }

  const checkOutTime = new Date(timestamp);
  const checkInTime = new Date(record.check_in_time);

  if (checkOutTime < checkInTime) {
    const error = new Error('Check-out time cannot be earlier than check-in time.');
    error.statusCode = 400;
    throw error;
  }

  // Update record
  const updatedRecord = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      check_out_time: checkOutTime,
      synced_offline: synced_offline || record.synced_offline,
    },
    include: {
      user: {
        select: {
          id: true,
          employee_id: true,
          name: true,
          department: true,
          job_title: true,
        },
      },
    },
  });

  // Emit real-time Socket.io updates
  await emitAttendanceUpdate(userId, updatedRecord, dateStr);

  return updatedRecord;
}

/**
 * Retrieve current user's attendance logs (daily or weekly).
 * 
 * @param {string} userId 
 * @param {'daily'|'weekly'} range 
 */
async function getMyAttendance(userId, range = 'daily') {
  const { dateStr } = getLocalTimeDetails(new Date());
  
  if (range === 'daily') {
    const dateMidnight = new Date(dateStr + 'T00:00:00.000Z');
    const record = await prisma.attendance.findUnique({
      where: {
        user_id_date: {
          user_id: userId,
          date: dateMidnight,
        },
      },
    });
    return record;
  } else {
    // Weekly range - last 7 calendar days
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6); // 7 days total inclusive

    const startLocal = getLocalTimeDetails(start).dateStr;
    const endLocal = getLocalTimeDetails(today).dateStr;

    const records = await prisma.attendance.findMany({
      where: {
        user_id: userId,
        date: {
          gte: new Date(startLocal + 'T00:00:00.000Z'),
          lte: new Date(endLocal + 'T00:00:00.000Z'),
        },
      },
      orderBy: { date: 'asc' },
    });
    return records;
  }
}

/**
 * Retrieve all attendance logs (Admin view).
 * 
 * @param {{ employeeId?: string, startDate?: string, endDate?: string }} filters 
 */
async function getAllAttendance(filters = {}) {
  const { employeeId, startDate, endDate } = filters;
  const where = {};

  if (employeeId) {
    where.user_id = employeeId;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      where.date.lte = new Date(endDate + 'T00:00:00.000Z');
    }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          employee_id: true,
          name: true,
          department: true,
          job_title: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  return records;
}

/**
 * Helper to emit socket events on attendance changes.
 */
async function emitAttendanceUpdate(userId, record, dateStr) {
  try {
    const io = getIO();
    const payload = {
      id: record.id,
      user_id: userId,
      date: dateStr,
      check_in_time: record.check_in_time ? record.check_in_time.toISOString() : null,
      check_out_time: record.check_out_time ? record.check_out_time.toISOString() : null,
      status: record.status,
      synced_offline: record.synced_offline,
      user: record.user,
    };

    // 1. Emit to the specific user room: attendance:update:{userId}
    io.to(`user:${userId}`).emit(`attendance:update:${userId}`, payload);

    // 2. Emit to the admins-only room: attendance:update
    io.to('admins').emit('attendance:update', payload);

    console.log(`[SOCKET] Emitted attendance updates for user ${userId}`);
  } catch (err) {
    console.error('[SOCKET] Failed to emit attendance:update:', err.message);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
};
