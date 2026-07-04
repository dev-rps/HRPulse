'use strict';

const { Router } = require('express');
const controller = require('./auth.controller');

const router = Router();

// POST /api/auth/signup
// Register a new user account. Returns userId + dev-mode verification token.
router.post('/signup', controller.signup);

// POST /api/auth/verify-email
// Consume the email verification token to activate an account.
router.post('/verify-email', controller.verifyEmail);

// POST /api/auth/login
// Authenticate. Returns access token in body + refresh token in httpOnly cookie.
router.post('/login', controller.login);

// POST /api/auth/refresh
// Exchange a valid refresh token (cookie) for a new access token.
router.post('/refresh', controller.refresh);

// POST /api/auth/logout
// Revoke the session (deletes the session row). Clears the refresh cookie.
router.post('/logout', controller.logout);

module.exports = router;
