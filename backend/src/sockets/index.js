'use strict';

/**
 * Socket.io server — real-time event hub.
 *
 * Architecture:
 *   - Each authenticated user joins a personal room: `user:{userId}`
 *   - Services emit events to that room so only the target user receives them
 *   - The `getIO()` singleton export lets any service module emit without
 *     creating a circular import (services import getIO, not the http server)
 *
 * Auth handshake:
 *   Client must pass their JWT access token as:
 *     socket.connect({ auth: { token: "<access_token>" } })
 *   Unauthenticated connections are rejected before the socket is established.
 *
 * ─── Shared Event Naming Convention ──────────────────────────────────────────
 * ALL team members MUST use these exact event names.
 * Pattern: `<domain>:<action>:<userId>`
 *
 *   leave:status:{userId}          — Leave service → employee on approval/rejection
 *   attendance:update:{userId}     — Attendance module → user on check-in/check-out
 *   notification:new:{userId}      — Any service → user on new notification
 *   payroll:processed:{userId}     — Payroll module → user when payslip is ready
 *
 * Emit from any service:
 *   const { getIO } = require('../../sockets');
 *   getIO().to(`user:${userId}`).emit(`leave:status:${userId}`, payload);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../lib/jwt');

/** @type {import('socket.io').Server | null} */
let _io = null;

/**
 * Initialize the Socket.io server.
 * Called once in server.js after the HTTP server is created.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSockets(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
      credentials: true,
    },
    // Transports: prefer websocket, fall back to polling
    transports: ['websocket', 'polling'],
  });

  // ── JWT Authentication Middleware ──────────────────────────────────────────
  _io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required: provide token in socket.handshake.auth'));
    }

    try {
      const decoded = verifyAccessToken(token);
      // Attach user context to socket for use in event handlers
      socket.user = {
        id: decoded.id,
        role: decoded.role,
        department: decoded.department ?? null,
        employee_id: decoded.employee_id,
      };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('TOKEN_EXPIRED: Access token expired. Refresh and reconnect.'));
      }
      return next(new Error('TOKEN_INVALID: Invalid access token.'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  _io.on('connection', (socket) => {
    const { id: userId, role, employee_id } = socket.user;

    // Join personal room — all targeted events use this room
    socket.join(`user:${userId}`);

    console.log(
      `[SOCKET] Connected  → id=${socket.id} user=${employee_id} role=${role} room=user:${userId}`
    );

    // ── Client → Server events ───────────────────────────────────────────────
    // (Currently read-only from server perspective; clients subscribe to rooms)

    socket.on('disconnect', (reason) => {
      console.log(
        `[SOCKET] Disconnected → id=${socket.id} user=${employee_id} reason=${reason}`
      );
    });

    socket.on('error', (err) => {
      console.error(`[SOCKET] Error → id=${socket.id}:`, err.message);
    });
  });

  console.log('[SOCKET] Socket.io initialized');
  return _io;
}

/**
 * Get the initialized Socket.io instance.
 * Use this in any service to emit events.
 *
 * @returns {import('socket.io').Server}
 * @throws {Error} if called before initSockets()
 */
function getIO() {
  if (!_io) {
    throw new Error(
      'Socket.io not initialized. Call initSockets(httpServer) in server.js first.'
    );
  }
  return _io;
}

// ─── Event name constants ─────────────────────────────────────────────────────
// Import these in any module to avoid magic-string typos.

const SOCKET_EVENTS = {
  /** Leave approved or rejected — payload: { requestId, status, comment, updatedAt } */
  leaveStatus: (userId) => `leave:status:${userId}`,

  /** Attendance record updated — payload: { date, checkIn, checkOut, status } */
  attendanceUpdate: (userId) => `attendance:update:${userId}`,

  /** New notification — payload: { id, type, message, read, createdAt } */
  notificationNew: (userId) => `notification:new:${userId}`,

  /** Payroll processed — payload: { month, year, netPay } */
  payrollProcessed: (userId) => `payroll:processed:${userId}`,
};

module.exports = { initSockets, getIO, SOCKET_EVENTS };
