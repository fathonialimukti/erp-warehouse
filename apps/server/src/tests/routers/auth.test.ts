
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, deleteTestRole } from '../helpers/seed.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';

let actorRoleId: string;
let userId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([]);
  actorRoleId = role.id;
  const email = `auth-${randomUUID()}@example.com`;
  const password = 'Test1234!';
  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: 'Auth Test User',
      email,
      password: hashed,
      roleId: actorRoleId,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await deleteTestRole(actorRoleId);
});

describe('auth router', () => {
  it('logs in, queries current user, and logs out', async () => {
    const publicCaller = createCaller(null);
    const email = await prisma.user.findUnique({ where: { id: userId } }).then((user) => user?.email ?? '');
    const login = await publicCaller.auth.login({ email, password: 'Test1234!', rememberMe: false });

    expect(login.user.id).toBe(userId);
    expect(login.tokenExpiresAt).toBeGreaterThan(Date.now());

    const caller = createCaller({ userId, email, name: 'Auth Test User' });
    const me = await caller.auth.me();
    expect(me.user.id).toBe(userId);
    expect(me.user.email).toBe(email);

    const logout = await caller.auth.logout();
    expect(logout.success).toBe(true);
  });
});
