'use strict';

/**
 * requireAuth middleware — JWT verification guard.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies its signature and expiry, then attaches the decoded
 * payload to `req.user`.
 *
 * Usage (always chain before requireRole):
 *   router.get('/protected', requireAuth, handler)
 *   router.get('/admin-only', requireAuth, requireRole(['admin']), handler)
 *
 * Error responses:
 *   401 — missing token, invalid signature, or expired token
 */

const { verifyAccessToken } = require('../lib/jwt');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Provide a Bearer token.',
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = verifyAccessToken(token);

    // Attach user context — available in all downstream middleware and handlers
    req.user = {
      id: decoded.id,
      role: decoded.role,
      department: decoded.department ?? null,
      employee_id: decoded.employee_id,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access token expired. Use /api/auth/refresh to get a new one.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      error: 'Invalid access token.',
      code: 'TOKEN_INVALID',
    });
  }
}

module.exports = requireAuth;
