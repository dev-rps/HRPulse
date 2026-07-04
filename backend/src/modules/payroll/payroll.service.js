'use strict';

const prisma = require('../../lib/prisma');

/**
 * Fetch the most recent salary structure for an employee.
 * Returns null if no structure is set yet.
 */
async function getRecentSalaryStructure(userId) {
  return prisma.salaryStructure.findFirst({
    where: { user_id: userId },
    orderBy: { effective_from: 'desc' },
  });
}

/**
 * Inserts a NEW salary structure row for an employee to preserve history.
 *
 * DESIGN DETAIL (Demo talking point):
 * We do not overwrite existing records. By inserting a new row with the current date,
 * we keep a complete audit trail of the employee's compensation history (e.g. raises, role changes).
 */
async function createSalaryStructure(userId, data) {
  const { basic, hra, allowances, deductions } = data;

  // Validate inputs are numeric
  const basicVal = parseFloat(basic);
  const hraVal = parseFloat(hra);
  const allowancesVal = parseFloat(allowances);
  const deductionsVal = parseFloat(deductions);

  if (isNaN(basicVal) || isNaN(hraVal) || isNaN(allowancesVal) || isNaN(deductionsVal)) {
    const err = new Error('All salary fields (basic, hra, allowances, deductions) must be valid numbers.');
    err.statusCode = 400;
    throw err;
  }

  // Calculate net salary
  const netSalary = basicVal + hraVal + allowancesVal - deductionsVal;

  // Verify the user exists first
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  // Insert new structure row
  return prisma.salaryStructure.create({
    data: {
      user_id: userId,
      basic: basicVal,
      hra: hraVal,
      allowances: allowancesVal,
      deductions: deductionsVal,
      net_salary: netSalary,
      effective_from: new Date(), // today's date
    },
  });
}

/**
 * List all users with the role 'employee'.
 */
async function listEmployees() {
  return prisma.user.findMany({
    where: { role: 'employee' },
    select: {
      id: true,
      name: true,
      employee_id: true,
      department: true,
      job_title: true,
    },
    orderBy: { name: 'asc' },
  });
}

module.exports = {
  getRecentSalaryStructure,
  createSalaryStructure,
  listEmployees,
};
