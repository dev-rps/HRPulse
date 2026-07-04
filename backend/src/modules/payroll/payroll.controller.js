'use strict';

const payrollService = require('./payroll.service');

async function getMySalary(req, res, next) {
  try {
    const salary = await payrollService.getRecentSalaryStructure(req.user.id);
    if (!salary) {
      return res.status(200).json({ data: null, message: 'No salary structure configured.' });
    }
    return res.status(200).json({ data: salary });
  } catch (err) {
    next(err);
  }
}

async function getUserSalary(req, res, next) {
  try {
    const { userId } = req.params;
    const salary = await payrollService.getRecentSalaryStructure(userId);
    if (!salary) {
      return res.status(200).json({ data: null, message: 'No salary structure configured for this user.' });
    }
    return res.status(200).json({ data: salary });
  } catch (err) {
    next(err);
  }
}

async function updateUserSalary(req, res, next) {
  try {
    const { userId } = req.params;
    const newSalary = await payrollService.createSalaryStructure(userId, req.body);
    return res.status(201).json({
      message: 'Salary structure updated successfully (new historical record created).',
      data: newSalary,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

async function listEmployees(req, res, next) {
  try {
    const employees = await payrollService.listEmployees();
    return res.status(200).json({ data: employees });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMySalary,
  getUserSalary,
  updateUserSalary,
  listEmployees,
};
