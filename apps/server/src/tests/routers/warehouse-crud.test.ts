
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, deleteTestRole, deleteTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string | undefined;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['warehouse@read', 'warehouse@create', 'warehouse@update', 'warehouse@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Warehouse CRUD Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (warehouseId) {
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  }
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('warehouse CRUD router', () => {
  it('creates, updates, and deletes a warehouse', async () => {
    const created = await caller.warehouse.warehouse.create({
      code: `TEST_WAREHOUSE_${randomUUID()}`,
      name: 'Test Warehouse CRUD',
      address: '123 Warehouse St',
      totalCapacity: 500,
    });
    expect(created.name).toBe('Test Warehouse CRUD');
    warehouseId = created.id;

    const updated = await caller.warehouse.warehouse.update({
      currentId: created.id,
      code: `TEST_WAREHOUSE_UPDATED_${randomUUID()}`,
      name: 'Updated Warehouse CRUD',
      address: '456 Warehouse Ave',
      totalCapacity: 1000,
    });
    expect(updated.name).toBe('Updated Warehouse CRUD');
    expect(updated.id).toBe(created.id);
    warehouseId = created.id;

    const deleted = await caller.warehouse.warehouse.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    warehouseId = undefined;
  });
});
