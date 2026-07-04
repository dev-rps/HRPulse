'use strict';

/**
 * Singleton PrismaClient instance.
 *
 * Node.js caches modules, so this file is only executed once — the same
 * PrismaClient instance is reused across all imports. In development, hot
 * reloads would create new instances on every restart; the globalThis guard
 * prevents connection pool exhaustion during nodemon restarts.
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error'],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
