import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { prisma } from '../../lib/prisma.js';
import { __testHooks } from '../../routers/landing.js';

const anonCaller = () => createCaller(null);

beforeEach(() => {
  __testHooks.clearContactRateLimits();
});

describe('landing router', () => {
  it('persists contact submissions', async () => {
    const email = `contact-${randomUUID()}@example.com`;
    const result = await anonCaller().landing.submitContact({
      name: 'Test User',
      email,
      message: 'Hello, need a demo.',
    });

    expect(result.success).toBe(true);
    const row = await prisma.contactSubmission.findUnique({ where: { id: result.id } });
    expect(row?.email).toBe(email);
    expect(row?.company).toBeNull();

    await prisma.contactSubmission.delete({ where: { id: result.id } });
  });

  it('rate-limits anonymous contact spam', async () => {
    const email = `spam-${randomUUID()}@example.com`;
    const base = { name: 'Spammer', email, message: 'spam' };
    for (let i = 0; i < 5; i++) {
      await anonCaller().landing.submitContact({ ...base, message: `spam ${i}` });
    }
    await expect(anonCaller().landing.submitContact({ ...base, message: 'one too many' })).rejects.toThrowError(
      /too many/i
    );

    await prisma.contactSubmission.deleteMany({ where: { email } });
  });
});
