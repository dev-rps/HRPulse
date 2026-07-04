'use strict';

const leaveService = require('./leave-application.service');

async function getMyLeaveRequests(req, res, next) {
  try {
    const requests = await leaveService.getMyLeaveRequests(req.user.id);
    return res.status(200).json({ data: requests, count: requests.length });
  } catch (err) {
    next(err);
  }
}

async function getMyLeaveBalances(req, res, next) {
  try {
    const balances = await leaveService.getMyLeaveBalances(req.user.id);
    return res.status(200).json({ data: balances });
  } catch (err) {
    next(err);
  }
}

async function submitLeaveRequest(req, res, next) {
  try {
    const request = await leaveService.submitLeaveRequest(req.user.id, req.body);
    return res.status(201).json({ data: request });
  } catch (err) {
    // If it's a known validation/business rule error, return details nicely
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message,
      });
    }
    next(err);
  }
}

module.exports = {
  getMyLeaveRequests,
  getMyLeaveBalances,
  submitLeaveRequest,
};
