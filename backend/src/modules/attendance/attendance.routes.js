'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./attendance.controller');

const router = Router();

// All routes in this module require authentication
router.use(requireAuth);

// POST /api/attendance/check-in - Record today's check-in
router.post('/check-in', controller.checkIn);

// POST /api/attendance/check-out - Record today's check-out
router.post('/check-out', controller.checkOut);

// GET /api/attendance/me - Get current employee's daily/weekly logs
router.get('/me', controller.getMyAttendance);

// GET /api/attendance/all - Get all employee logs (Admin only, filterable)
router.get('/all', requireRole(['admin']), controller.getAllAttendance);

module.exports = router;
