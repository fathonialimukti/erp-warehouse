
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, deleteTestRole, deleteTestUser } from '../helpers/seed.js';

let actorRoleId: string;
let actorUserId: string;
let caller: ReturnType<typeof createCaller>;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['warehouse@read']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Dashboard Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('dashboard router', () => {
  it('returns summary and warehouse allocations', async () => {
    const summary = await caller.dashboard.summary();
    expect(summary.palletTurnover).toBeDefined();
    expect(summary.pendingApprovals).toBeDefined();
    expect(summary.execution).toBeDefined();

    const allocations = await caller.dashboard.warehouseAllocations();
    expect(Array.isArray(allocations)).toBe(true);
  });
});
