
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, seedTestSku, seedTestWarehouse, deleteTestRole, deleteTestUser, deleteTestSku, deleteTestWarehouse } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
const completionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['wip-completion@read', 'wip-completion@create', 'wip-completion@update', 'wip-completion@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'WIP Completion Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
});

afterAll(async () => {
  if (completionIds.length > 0) {
    await prisma.wipCompletion.deleteMany({ where: { id: { in: completionIds } } });
  }
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('wip completion router', () => {
  it('creates, updates, and deletes a WIP completion record', async () => {
    const created = await caller.wipCompletion.create({
      warehouseId,
      workOrderRef: 'WO-1',
      productionBatchNo: 'BATCH-1',
      reference: 'REF-1',
      notes: 'Notes',
      items: [{ skuId, quantity: 1, details: 'details' }],
      approvalHistory: [],
    });
    expect(created.items.length).toBe(1);
    completionIds.push(created.id);

    const updated = await caller.wipCompletion.update({
      id: created.id,
      warehouseId,
      workOrderRef: 'WO-2',
      productionBatchNo: 'BATCH-2',
      reference: 'REF-2',
      notes: 'Updated notes',
      items: [{ skuId, quantity: 2, details: 'details' }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });
    expect(updated.workOrderRef).toBe('WO-2');

    const deleted = await caller.wipCompletion.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    completionIds.pop();
  });
});
