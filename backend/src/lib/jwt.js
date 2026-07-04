'use strict';

/**
 * JWT token helpers.
 *
 * Access token  — short-lived (15 min), sent in Authorization header.
 * Refresh token — long-lived (7 days), sent/stored in httpOnly cookie.
 *
 * Secrets are read from environment at call-time (not module load) so that
 * tests can override process.env before requiring this module.
 */

const jwt = require('jsonwebtoken');

// ─── Token Generation ─────────────────────────────────────────────────────────

/**
 * @param {{ id: string, role: string, department: string|null, employee_id: string }} payload
 * @returns {string} signed JWT
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

/**
 * @param {{ id: string }} payload - minimal payload; full claims re-fetched on use
 * @returns {string} signed JWT
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

// ─── Token Verification ───────────────────────────────────────────────────────

/**
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

/**
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
