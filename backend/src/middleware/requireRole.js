'use strict';

/**
 * requireRole middleware factory — RBAC guard.
 *
 * MUST be chained AFTER requireAuth (depends on req.user being set).
 *
 * Usage:
 *   router.patch('/decision', requireAuth, requireRole(['admin']), handler)
 *   router.get('/reports', requireAuth, requireRole(['admin', 'manager']), handler)
 *
 * @param {string[]} allowedRoles - Array of Role enum values that may access the route
 * @returns {Function} Express middleware
 *
 * Error responses:
 *   403 — authenticated but insufficient role
 */

function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      // Should not happen if requireAuth was chained first — safety net
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
}

module.exports = requireRole;
