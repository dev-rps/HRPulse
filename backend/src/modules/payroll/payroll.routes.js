'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./payroll.controller');

const router = Router();

// All payroll routes require authentication
router.use(requireAuth);

// GET /api/payroll/me - Read-only for self (employee or admin)
router.get('/me', controller.getMySalary);

// GET /api/payroll/employees - Admin only: list all employees for selection
router.get('/employees', requireRole(['admin']), controller.listEmployees);

// GET /api/payroll/:userId - Admin only: read another user's current salary
router.get('/:userId', requireRole(['admin']), controller.getUserSalary);

// PUT /api/payroll/:userId - Admin only: insert new salary record for user
router.put('/:userId', requireRole(['admin']), controller.updateUserSalary);

module.exports = router;
