
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, deleteTestRole } from '../helpers/seed.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { DEMO_PASSWORD, SEED_USERS } from '../../prisma/seed/catalog/users.js';

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

describe('demo login gate (disabled)', () => {
  let savedFlag: string | undefined;

  beforeEach(() => {
    savedFlag = process.env.DEMO_LOGIN_ENABLED;
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = savedFlag;
  });

  it('demoUsers returns [] when DEMO_LOGIN_ENABLED is unset', async () => {
    delete process.env.DEMO_LOGIN_ENABLED;
    const caller = createCaller(null);
    await expect(caller.auth.demoUsers()).resolves.toEqual([]);
  });

  it('demoUsers returns [] when DEMO_LOGIN_ENABLED is "false"', async () => {
    process.env.DEMO_LOGIN_ENABLED = 'false';
    const caller = createCaller(null);
    await expect(caller.auth.demoUsers()).resolves.toEqual([]);
  });

  it('demoLogin throws FORBIDDEN auth.demoDisabled when disabled', async () => {
    const caller = createCaller(null);
    // Gate fires before any user lookup, so the base actor id is a valid probe.
    const probes: (string | undefined)[] = [undefined, 'false'];
    for (const value of probes) {
      if (value === undefined) delete process.env.DEMO_LOGIN_ENABLED;
      else process.env.DEMO_LOGIN_ENABLED = value;
      await expect(caller.auth.demoLogin({ userId })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Demo login is disabled',
      });
    }
  });
});

describe('demo login gate (enabled)', () => {
  let savedFlag: string | undefined;
  let demoRoleId: string;
  const createdUserIds: string[] = [];
  let n8nUserId = '';

  const humanDemoEmails = SEED_USERS.filter((u) => u.role !== null).map((u) => u.email);

  beforeEach(() => {
    savedFlag = process.env.DEMO_LOGIN_ENABLED;
    process.env.DEMO_LOGIN_ENABLED = 'true';
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = savedFlag;
  });

  beforeAll(async () => {
    const role = await seedRoleWithPermissions(['user@read']);
    demoRoleId = role.id;
    const demoHash = await hashPassword(DEMO_PASSWORD);

    // Ensure the 7 human roster rows exist (create only when missing so a real
    // seed is never clobbered); unlock them for a deterministic demoLogin.
    for (const entry of SEED_USERS) {
      if (entry.role === null) continue;
      const existing = await prisma.user.findUnique({ where: { email: entry.email } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      } else {
        const created = await prisma.user.create({
          data: { name: entry.name, email: entry.email, password: demoHash, roleId: demoRoleId },
        });
        createdUserIds.push(created.id);
      }
    }

    // Ensure the NULL-role ai-system row exists (never listed, never loggable).
    const aiSystem = await prisma.user.findUnique({ where: { email: 'ai-system@aetherglo.com' } });
    if (!aiSystem) {
      const created = await prisma.user.create({
        data: { name: 'AI System', email: 'ai-system@aetherglo.com', password: await hashPassword(randomUUID()) },
      });
      createdUserIds.push(created.id);
    }

    // n8n probe: passes the @aetherglo.com domain check so it isolates the
    // n8n blocklist branch of demoLogin. Random suffix avoids seed collisions.
    const n8n = await prisma.user.create({
      data: { name: 'n8n probe', email: `n8n-${randomUUID()}@aetherglo.com`, password: demoHash, roleId: demoRoleId },
    });
    n8nUserId = n8n.id;
    createdUserIds.push(n8n.id);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await deleteTestRole(demoRoleId);
  });

  it('demoUsers lists the 7 aetherglo.com humans with role+permissions, excluding NULL-role users', async () => {
    const caller = createCaller(null);
    const users = await caller.auth.demoUsers();

    for (const email of humanDemoEmails) {
      const found = users.find((u) => u.email === email);
      expect(found, `expected demo roster to include ${email}`).toBeDefined();
      if (!found) continue;
      expect(found.role).not.toBeNull();
      expect(found.role?.name).toBeTruthy();
      expect(Array.isArray(found.role?.permissions)).toBe(true);
    }
    expect(users.some((u) => u.email === 'ai-system@aetherglo.com')).toBe(false);
    expect(users.every((u) => u.role !== null)).toBe(true);
    // Note: demoUsers filters on role (NOT NULL), not email — the n8n
    // blocklist lives in demoLogin, and the seeder never creates n8n rows
    // (covered by the seeder-roster suite below), so no n8n assertion here.
  });

  it('demoLogin succeeds for inbound@aetherglo.com', async () => {
    const inbound = await prisma.user.findUnique({ where: { email: 'inbound@aetherglo.com' } });
    if (!inbound) throw new Error('inbound demo fixture missing');
    const caller = createCaller(null);
    const result = await caller.auth.demoLogin({ userId: inbound.id });

    expect(result.user.email).toBe('inbound@aetherglo.com');
    expect(result.user.roles.length).toBeGreaterThan(0);
    expect(result.tokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it('demoLogin rejects ai-system (NULL role) with UNAUTHORIZED', async () => {
    const aiSystem = await prisma.user.findUnique({ where: { email: 'ai-system@aetherglo.com' } });
    if (!aiSystem) throw new Error('ai-system fixture missing');
    const caller = createCaller(null);
    await expect(caller.auth.demoLogin({ userId: aiSystem.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('demoLogin rejects n8n emails with UNAUTHORIZED', async () => {
    const caller = createCaller(null);
    await expect(caller.auth.demoLogin({ userId: n8nUserId })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('demo seeder roster', () => {
  it('has no n8n entry', () => {
    expect(SEED_USERS.some((u) => u.email.toLowerCase().includes('n8n'))).toBe(false);
  });

  it('seeds ai-system with a null role', () => {
    const aiSystem = SEED_USERS.find((u) => u.email === 'ai-system@aetherglo.com');
    expect(aiSystem).toBeDefined();
    expect(aiSystem?.role).toBeNull();
  });

  it('shares one demo password constant across all @aetherglo.com demo emails', () => {
    expect(typeof DEMO_PASSWORD).toBe('string');
    expect(DEMO_PASSWORD.length).toBeGreaterThan(0);
    expect(SEED_USERS.length).toBeGreaterThan(0);
    for (const u of SEED_USERS) {
      expect(u.email.endsWith('@aetherglo.com')).toBe(true);
    }
    expect(SEED_USERS.filter((u) => u.role !== null)).toHaveLength(7);
  });
});
