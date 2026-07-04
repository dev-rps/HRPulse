'use strict';

/**
 * Server bootstrap — creates HTTP server, attaches Socket.io, starts listening.
 *
 * Import order matters:
 *   1. dotenv first — so all modules read env vars correctly
 *   2. app factory
 *   3. socket initializer (needs the HTTP server reference)
 */

require('dotenv').config();

const http = require('http');
const createApp = require('./app');
const { initSockets } = require('./sockets');
const prisma = require('./lib/prisma');

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function main() {
  // ── Verify DB connection before accepting traffic ─────────────────────────
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.error('[DB] Failed to connect to database:', err.message);
    process.exit(1);
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  // Attach Socket.io to the same HTTP server
  initSockets(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 HRPulse API running on http://localhost:${PORT}`);
    console.log(`   Health check : http://localhost:${PORT}/health`);
    console.log(`   Environment  : ${process.env.NODE_ENV ?? 'development'}`);
    console.log(`   Socket.io    : enabled\n`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[SERVER] ${signal} received — shutting down gracefully`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      console.log('[SERVER] Closed. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[SERVER] Fatal startup error:', err);
  process.exit(1);
});
