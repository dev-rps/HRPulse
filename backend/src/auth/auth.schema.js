'use strict';

/**
 * Zod validation schemas for the Auth module.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for input shapes.
 * Imported by auth.controller.js and can be re-used by the frontend
 * to keep validation in sync (export them via api-contract or a shared lib).
 *
 * Password rules (enforced server-side even if frontend validates too):
 *   - Minimum 8 characters
 *   - At least 1 numeric digit
 *   - At least 1 special character from: !@#$%^&*()_+-=[]{}|;':,./<>?
 */

const { z } = require('zod');

// ─── Reusable password rule ───────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()\-_=+\[\]{}|;':",.<>/?\\]/,
    'Password must contain at least one special character'
  );

// ─── Auth schemas ─────────────────────────────────────────────────────────────

const signupSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required').trim(),
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: passwordSchema,
  role: z.enum(['admin', 'employee']).default('employee'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  date_of_joining: z.string().datetime({ message: 'Invalid date format' }).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().uuid('Invalid verification token format'),
});

module.exports = {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  passwordSchema,
};
