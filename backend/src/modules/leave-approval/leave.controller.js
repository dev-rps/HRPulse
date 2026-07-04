'use strict';

/**
 * Leave Controller — thin HTTP layer for the leave approval module.
 */

const leaveService = require('./leave.service');

// GET /api/leave-requests
async function getLeaveRequests(req, res, next) {
  try {
    const { status, year } = req.query;
    const requests = await leaveService.getLeaveRequests(req.user, { status, year });
    return res.status(200).json({ data: requests, count: requests.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/leave-requests
async function submitLeaveRequest(req, res, next) {
  try {
    const request = await leaveService.submitLeaveRequest(req.user.id, req.body);
    return res.status(201).json({ data: request });
  } catch (err) {
    if (err.details) {
      return res.status(err.statusCode ?? 400).json({
        error: err.message,
        details: err.details,
      });
    }
    next(err);
  }
}

// PATCH /api/leave-requests/:id/decision
async function makeDecision(req, res, next) {
  try {
    const { id } = req.params;
    const result = await leaveService.makeDecision(id, req.body, req.user);
    return res.status(200).json(result);
  } catch (err) {
    if (err.details) {
      return res.status(err.statusCode ?? 400).json({
        error: err.message,
        details: err.details,
      });
    }
    next(err);
  }
}

// DELETE /api/leave-requests/:id
async function cancelLeaveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const result = await leaveService.cancelLeaveRequest(id, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLeaveRequests,
  submitLeaveRequest,
  makeDecision,
  cancelLeaveRequest,
};
