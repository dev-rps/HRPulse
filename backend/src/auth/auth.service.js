'use strict';

/**
 * Auth Service — business logic layer.
 *
 * All functions throw plain Error objects with a `statusCode` property.
 * The controller catches these and sends the appropriate HTTP response.
 *
 * Security notes:
 *   - Passwords are hashed with bcrypt (12 rounds — deliberate slow hash).
 *   - Refresh tokens are stored as SHA-256 hashes; raw tokens are never persisted.
 *   - Auth error messages are intentionally generic to prevent user enumeration.
 *     Internal console logs may reveal more detail for debugging only.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../lib/jwt');

const BCRYPT_ROUNDS = 12;
const VERIFY_TOKEN_EXPIRY_HOURS = 24;
// Refresh cookie name — must match requireAuth middleware and logout
const REFRESH_COOKIE_NAME = 'hrpulse_refresh';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hash a refresh token for safe storage.
 * We never store the raw JWT — only its SHA-256 fingerprint.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Build the safe user object returned in API responses.
 * Strips password_hash and other internal fields.
 */
function safeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Build a generic auth error (used for login failures to prevent enumeration).
 */
function authError() {
  const err = new Error('Invalid email or password');
  err.statusCode = 401;
  return err;
}

// ─── Signup ───────────────────────────────────────────────────────────────────

/**
 * Register a new user, create their email verification token.
 *
 * DEMO NOTE: In production, the verification token would be sent via SMTP
 * (e.g., Nodemailer). For this hackathon demo:
 *   1. The token is logged to the server console.
 *   2. When NODE_ENV !== 'production', the token is also returned in the
 *      API response body under `_dev_verify_token` so the demo can proceed
 *      without an email client. Remove this field before production.
 */
async function signup(data) {
  const {
    employee_id,
    name,
    email,
    password,
    role,
    phone,
    address,
    department,
    job_title,
    date_of_joining,
  } = data;

  // Check duplicates — query both fields in one round-trip
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { employee_id }] },
    select: { id: true, email: true, employee_id: true },
  });

  if (existing) {
    // Log internal detail server-side; return generic message to client
    console.warn(
      `[AUTH] Signup blocked — duplicate ${existing.email === email ? 'email' : 'employee_id'}: ${email}`
    );
    const err = new Error('An account with these details already exists');
    err.statusCode = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      employee_id,
      name,
      email,
      password_hash,
      role,
      phone: phone ?? null,
      address: address ?? null,
      department: department ?? null,
      job_title: job_title ?? null,
      date_of_joining: date_of_joining ? new Date(date_of_joining) : null,
    },
  });

  // ── Email verification token ───────────────────────────────────────────────
  const token = uuidv4();
  const expires_at = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerification.create({
    data: { user_id: user.id, token, expires_at },
  });

  // ── DEMO NOTE ──────────────────────────────────────────────────────────────
  // Production: replace the console.log below with:
  //   await emailService.sendVerificationEmail(user.email, token);
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────');
  console.log(' [EMAIL VERIFICATION — DEMO MODE]');
  console.log(` User  : ${user.email}`);
  console.log(` Token : ${token}`);
  console.log(' Use this token in POST /api/auth/verify-email');
  console.log('──────────────────────────────────────────────\n');

  const response = {
    message: 'Account created. Please verify your email to continue.',
    userId: user.id,
  };

  // Only expose token in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    response._dev_verify_token = token;
    response._dev_note =
      'This field is only present in non-production environments. Remove before go-live.';
  }

  return response;
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

async function verifyEmail({ token }) {
  const record = await prisma.emailVerification.findUnique({
    where: { token },
  });

  if (!record) {
    const err = new Error('Invalid or expired verification token');
    err.statusCode = 400;
    throw err;
  }

  if (record.used) {
    const err = new Error('This verification link has already been used');
    err.statusCode = 400;
    throw err;
  }

  if (record.expires_at < new Date()) {
    const err = new Error('Verification token has expired. Request a new one.');
    err.statusCode = 400;
    throw err;
  }

  // Mark user verified and consume token atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user_id },
      data: { is_verified: true },
    }),
    prisma.emailVerification.update({
      where: { token },
      data: { used: true },
    }),
  ]);

  return { message: 'Email verified successfully. You can now log in.' };
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Returns { accessToken, user } on success.
 * Caller (controller) is responsible for setting the refresh cookie.
 */
async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // ── Security: constant-time path even when user not found ─────────────────
  // We always call bcrypt.compare to prevent timing-based enumeration.
  const DUMMY_HASH = '$2a$12$dummyhashtopreventtimingattackonnonexistentuser1234567';
  const passwordToCompare = user ? user.password_hash : DUMMY_HASH;
  const passwordValid = await bcrypt.compare(password, passwordToCompare);

  if (!user || !passwordValid) {
    // Log internal reason server-side only
    console.warn(`[AUTH] Login failed — ${!user ? 'user not found' : 'wrong password'}: ${email}`);
    throw authError();
  }

  if (!user.is_verified) {
    // Intentionally separate error so frontend can offer "resend verification"
    // but we still use 401 to avoid leaking which step failed to third parties
    console.warn(`[AUTH] Login blocked — email not verified: ${email}`);
    const err = new Error('Please verify your email address before logging in');
    err.statusCode = 401;
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  // ── Issue tokens ──────────────────────────────────────────────────────────
  const tokenPayload = {
    id: user.id,
    role: user.role,
    department: user.department,
    employee_id: user.employee_id,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user.id });

  // Store hashed refresh token in sessions table
  const refreshExpiryDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d', 10) || 7;
  const expires_at = new Date(Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at,
    },
  });

  return {
    accessToken,
    refreshToken, // controller sets this in httpOnly cookie
    user: safeUser(user),
  };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

/**
 * Validates the refresh token from the httpOnly cookie, issues a new access token.
 * Does NOT rotate the refresh token (simple implementation for hackathon).
 */
async function refresh(refreshToken) {
  if (!refreshToken) {
    const err = new Error('Refresh token missing');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  // Validate against stored session
  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: {
      user_id: payload.id,
      token_hash: tokenHash,
      expires_at: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    const err = new Error('Session not found or expired. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  const { user } = session;

  const accessToken = generateAccessToken({
    id: user.id,
    role: user.role,
    department: user.department,
    employee_id: user.employee_id,
  });

  return { accessToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Deletes the session row — refresh token is immediately revoked.
 * The access token (short-lived, 15 min) will expire on its own.
 */
async function logout(refreshToken) {
  if (!refreshToken) return; // Already logged out / no session

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    await prisma.session.deleteMany({
      where: { user_id: payload.id, token_hash: tokenHash },
    });
  } catch {
    // Token invalid — nothing to revoke, silently succeed
  }
}

// ─── User Update ─────────────────────────────────────────────────────────────

async function updateUserSelf(userId, body) {
  const { updateUserSelfSchema } = require('./auth.schema');
  const parsed = updateUserSelfSchema.safeParse(body);
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details = parsed.error.flatten().fieldErrors;
    throw err;
  }

  const { phone, address, profile_picture_url } = parsed.data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      phone: phone !== undefined ? phone : undefined,
      address: address !== undefined ? address : undefined,
      profile_picture_url: profile_picture_url !== undefined ? profile_picture_url : undefined,
    },
  });

  return safeUser(user);
}

async function updateUserAdmin(userId, body) {
  const { updateUserAdminSchema } = require('./auth.schema');
  const parsed = updateUserAdminSchema.safeParse(body);
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details = parsed.error.flatten().fieldErrors;
    throw err;
  }

  const { name, email, role, phone, address, profile_picture_url, job_title, department, date_of_joining } = parsed.data;

  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (existing) {
      const err = new Error('Email already in use by another account');
      err.statusCode = 409;
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role,
      phone: phone !== undefined ? phone : undefined,
      address: address !== undefined ? address : undefined,
      profile_picture_url: profile_picture_url !== undefined ? profile_picture_url : undefined,
      job_title: job_title !== undefined ? job_title : undefined,
      department: department !== undefined ? department : undefined,
      date_of_joining: date_of_joining !== undefined ? (date_of_joining ? new Date(date_of_joining) : null) : undefined,
    },
  });

  return safeUser(user);
}

module.exports = {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  updateUserSelf,
  updateUserAdmin,
  REFRESH_COOKIE_NAME,
};
