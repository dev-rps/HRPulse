'use strict';

const prisma = require('../../lib/prisma');
const { z } = require('zod');

const salaryStructureSchema = z.object({
  basic: z.coerce.number().min(0, 'Basic salary must be non-negative'),
  hra: z.coerce.number().min(0, 'HRA must be non-negative'),
  allowances: z.coerce.number().min(0, 'Allowances must be non-negative'),
  deductions: z.coerce.number().min(0, 'Deductions must be non-negative'),
});

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
  const parsed = salaryStructureSchema.safeParse(data);
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details = parsed.error.flatten().fieldErrors;
    throw err;
  }

  const { basic, hra, allowances, deductions } = parsed.data;

  // Calculate net salary
  const netSalary = basic + hra + allowances - deductions;

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
      basic: basic,
      hra: hra,
      allowances: allowances,
      deductions: deductions,
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
