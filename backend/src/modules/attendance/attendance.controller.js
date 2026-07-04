'use strict';

const attendanceService = require('./attendance.service');

/**
 * Handle POST /api/attendance/check-in
 */
async function checkIn(req, res, next) {
  try {
    const record = await attendanceService.checkIn(req.user.id, req.body);
    return res.status(201).json({ data: record });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Handle POST /api/attendance/check-out
 */
async function checkOut(req, res, next) {
  try {
    const record = await attendanceService.checkOut(req.user.id, req.body);
    return res.status(200).json({ data: record });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Handle GET /api/attendance/me
 */
async function getMyAttendance(req, res, next) {
  try {
    const { range = 'daily' } = req.query;
    if (range !== 'daily' && range !== 'weekly') {
      return res.status(400).json({ error: 'range must be either "daily" or "weekly".' });
    }
    const record = await attendanceService.getMyAttendance(req.user.id, range);
    return res.status(200).json({ data: record });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/attendance/all
 */
async function getAllAttendance(req, res, next) {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const records = await attendanceService.getAllAttendance({ employeeId, startDate, endDate });
    return res.status(200).json({ data: records, count: records.length });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
};
