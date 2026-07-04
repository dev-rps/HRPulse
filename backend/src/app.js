'use strict';

/**
 * Express application factory.
 *
 * Returns a configured Express app — does NOT start the HTTP server.
 * The server.js file creates the HTTP server and attaches Socket.io.
 * This separation makes the app testable without binding to a port.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// ─── Route modules ────────────────────────────────────────────────────────────
const authRoutes = require('./auth/auth.routes');
const leaveRoutes = require('./modules/leave-approval/leave.routes');

// ─── App factory ─────────────────────────────────────────────────────────────

function createApp() {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
      credentials: true, // Required for httpOnly cookies
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/leave-requests', leaveRoutes);

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ── Global error handler ────────────────────────────────────────────────────
  // Must have exactly 4 parameters for Express to treat it as error middleware
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode ?? 500;

    // Never leak stack traces or internal messages in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ERROR]', err);
    }

    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal server error' : err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  });

  return app;
}

module.exports = createApp;
