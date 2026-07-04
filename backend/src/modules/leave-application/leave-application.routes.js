'use strict';

const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const controller = require('./leave-application.controller');

const leaveBalancesRouter = Router();
leaveBalancesRouter.use(requireAuth);

// GET /api/leave-balances/me - Get own balances
leaveBalancesRouter.get('/me', controller.getMyLeaveBalances);

module.exports = {
  leaveBalancesRouter,
};
