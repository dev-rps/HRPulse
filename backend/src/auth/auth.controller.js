'use strict';

/**
 * Auth Controller — thin HTTP layer.
 *
 * Responsibilities:
 *   1. Parse and validate request input via Zod schemas.
 *   2. Call the corresponding service function.
 *   3. Set/clear cookies.
 *   4. Return the HTTP response.
 *
 * No business logic lives here — only request/response shaping.
 */

const { signupSchema, loginSchema, verifyEmailSchema } = require('./auth.schema');
const authService = require('./auth.service');

// ─── Cookie config ────────────────────────────────────────────────────────────

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,               // Not accessible via document.cookie
  secure: process.env.NODE_ENV === 'production', // HTTPS-only in prod
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',            // Scoped — cookie only sent to auth routes
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function signup(req, res, next) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await authService.signup(parsed.data);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await authService.verifyEmail(parsed.data);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { accessToken, refreshToken, user } = await authService.login(parsed.data);

    // Set refresh token in httpOnly cookie
    res.cookie(authService.REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user,
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[authService.REFRESH_COOKIE_NAME];
    const { accessToken } = await authService.refresh(refreshToken);
    return res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[authService.REFRESH_COOKIE_NAME];
    await authService.logout(refreshToken);

    // Clear the cookie regardless of whether the session existed
    res.clearCookie(authService.REFRESH_COOKIE_NAME, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: 0,
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateUserSelf(req, res, next) {
  try {
    const user = await authService.updateUserSelf(req.user.id, req.body);
    return res.status(200).json({ data: user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, details: err.details });
    }
    next(err);
  }
}

async function updateUserAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const user = await authService.updateUserAdmin(id, req.body);
    return res.status(200).json({ data: user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, details: err.details });
    }
    next(err);
  }
}

module.exports = { signup, verifyEmail, login, refresh, logout, updateUserSelf, updateUserAdmin };
