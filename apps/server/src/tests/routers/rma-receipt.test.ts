
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, seedTestSku, seedTestWarehouse, deleteTestRole, deleteTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
const receiptIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['rma-receipt@read', 'rma-receipt@create', 'rma-receipt@update', 'rma-receipt@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'RMA Receipt Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
});

afterAll(async () => {
  if (receiptIds.length > 0) {
    await prisma.rmaReceipt.deleteMany({ where: { id: { in: receiptIds } } });
  }
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('rma receipt router', () => {
  it('creates, updates, and deletes an RMA receipt', async () => {
    const created = await caller.rmaReceipt.create({
      warehouseId,
      salesOrderRef: 'SO-1',
      returnReason: 'RMA reason',
      reference: 'RMA-1',
      notes: 'Notes',
      items: [{ skuId, quantity: 1, details: 'detail' }],
      approvalHistory: [],
    });
    expect(created.items.length).toBe(1);
    receiptIds.push(created.id);

    const updated = await caller.rmaReceipt.update({
      id: created.id,
      warehouseId,
      salesOrderRef: 'SO-2',
      returnReason: 'RMA reason updated',
      reference: 'RMA-2',
      notes: 'Notes updated',
      items: [{ skuId, quantity: 2, details: 'detail' }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });
    expect(updated.salesOrderRef).toBe('SO-2');

    const deleted = await caller.rmaReceipt.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    receiptIds.pop();
  });
});
