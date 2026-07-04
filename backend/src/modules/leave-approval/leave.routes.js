'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const adminController = require('./leave.controller');
const employeeController = require('../leave-application/leave-application.controller');

const router = Router();

// All leave routes require authentication
router.use(requireAuth);

// GET /api/leave-requests?status=pending&year=2025
// Admin/Manager: all requests | Employee: own requests only (enforced in service)
router.get('/', adminController.getLeaveRequests);

// GET /api/leave-requests/me
// Employee: get own requests
router.get('/me', employeeController.getMyLeaveRequests);

// POST /api/leave-requests
// Employee submits a new leave request
router.post('/', employeeController.submitLeaveRequest);

// PATCH /api/leave-requests/:id/decision
// Admin/Manager only — approve or reject with optional comment
router.patch('/:id/decision', requireRole(['admin']), adminController.makeDecision);

// DELETE /api/leave-requests/:id
// Employee self-cancel (pending requests only — enforced in service)
router.delete('/:id', adminController.cancelLeaveRequest);

module.exports = router;
