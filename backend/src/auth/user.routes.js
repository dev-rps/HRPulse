'use strict';

const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const controller = require('./auth.controller');

const router = Router();

// All routes here require authentication
router.use(requireAuth);

// PATCH /api/users/me - Update self (phone, address, profile_picture_url only)
router.patch('/me', controller.updateUserSelf);

// PATCH /api/users/:id - Update user details (admin only OR self update)
router.patch('/:id', (req, res, next) => {
  // If the user is updating their own profile via /api/users/:id, route to updateUserSelf
  if (req.user.id === req.params.id) {
    return controller.updateUserSelf(req, res, next);
  }
  // Otherwise, require admin role
  requireRole(['admin'])(req, res, next);
}, controller.updateUserAdmin);

module.exports = router;
