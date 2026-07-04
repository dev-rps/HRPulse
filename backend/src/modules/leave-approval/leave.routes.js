'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./leave.controller');

const router = Router();

// All leave routes require authentication
router.use(requireAuth);

// GET /api/leave-requests?status=pending&year=2025
// Admin/Manager: all requests | Employee: own requests only (enforced in service)
router.get('/', controller.getLeaveRequests);

// POST /api/leave-requests
// Employee submits a new leave request
router.post('/', controller.submitLeaveRequest);

// PATCH /api/leave-requests/:id/decision
// Admin/Manager only — approve or reject with optional comment
router.patch('/:id/decision', requireRole(['admin']), controller.makeDecision);

// DELETE /api/leave-requests/:id
// Employee self-cancel (pending requests only — enforced in service)
router.delete('/:id', controller.cancelLeaveRequest);

module.exports = router;
