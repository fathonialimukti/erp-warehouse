
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, deleteTestRole, deleteTestUser } from '../helpers/seed.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['permission@read', 'role@read']);
  actorRoleId = role.id;

  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Access Control Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('access control router', () => {
  it('routes nested role and permission procedures', async () => {
    const permissions = await caller.accessControl.permission.list({ page: 1, limit: 10 });
    expect(Array.isArray(permissions.data)).toBe(true);
    expect(permissions.meta.total).toBeGreaterThanOrEqual(0);

    const roles = await caller.accessControl.role.list({ page: 1, limit: 10 });
    expect(Array.isArray(roles.data)).toBe(true);
    expect(roles.meta.total).toBeGreaterThanOrEqual(0);
  });
});
