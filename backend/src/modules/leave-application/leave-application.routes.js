'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const controller = require('./leave-application.controller');

const leaveRequestsRouter = Router();
leaveRequestsRouter.use(requireAuth);

// POST /api/leave-requests - Submit a request
leaveRequestsRouter.post('/', controller.submitLeaveRequest);

// GET /api/leave-requests/me - Get own requests
leaveRequestsRouter.get('/me', controller.getMyLeaveRequests);


const leaveBalancesRouter = Router();
leaveBalancesRouter.use(requireAuth);

// GET /api/leave-balances/me - Get own balances
leaveBalancesRouter.get('/me', controller.getMyLeaveBalances);

module.exports = {
  leaveRequestsRouter,
  leaveBalancesRouter,
};
