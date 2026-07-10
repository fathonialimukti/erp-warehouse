import 'dotenv/config';
import { afterAll } from 'vitest';

process.env.DB_POOL_MAX = process.env.DB_POOL_MAX ?? '5';
process.env.DB_POOL_IDLE_MS = process.env.DB_POOL_IDLE_MS ?? '10000';
process.env.DB_POOL_CONNECT_TIMEOUT_MS = process.env.DB_POOL_CONNECT_TIMEOUT_MS ?? '5000';

process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    warning.message.includes('Calling client.query() when the client is already executing a query')
  ) {
    return;
  }
  console.warn(warning);
});

const { prisma } = await import('../lib/prisma.js');

afterAll(async () => {
  await prisma.$disconnect();
});
