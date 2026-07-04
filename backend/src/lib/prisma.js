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

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
