import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestSku,
  seedTestSupplier,
  seedTestUser,
  seedTestWarehouse,
} from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
let supplierId: string;
const createdTransactionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'receiving@read',
    'receiving@create',
    'receiving@update',
    'receiving@delete',
    'receiving@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Receiving Transaction Test Actor',
  });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const supplier = await seedTestSupplier();
  supplierId = supplier.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdTransactionIds.length > 0) {
    await prisma.receivingTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.supplier.delete({ where: { id: supplierId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('receiving transaction router', () => {
  it('creates a draft receiving transaction and logs activity', async () => {
    const transaction = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      purchaseOrderRef: 'PO-1',
      notes: 'Receiving create test',
      items: [{ skuId, quantity: 2 }],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);
    const item = transaction.items[0];
    if (!item) throw new Error('Expected created transaction to contain an item');
    expect(Number(item.quantity)).toBe(2);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'receiving_transaction', resourceId: transaction.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('updates a draft receiving transaction and logs activity', async () => {
    const created = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Receiving update test',
      items: [{ skuId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    const updated = await caller.receivingTransaction.update({
      id: created.id,
      warehouseId,
      supplierId,
      notes: 'Updated receiving notes',
      items: [{ skuId, quantity: 3 }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });

    expect(updated.notes).toBe('Updated receiving notes');
    const updatedItem = updated.items[0];
    if (!updatedItem) throw new Error('Expected updated transaction to contain an item');
    expect(Number(updatedItem.quantity)).toBe(3);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'receiving_transaction', resourceId: updated.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('proposes and rejects a receiving transaction and logs activity', async () => {
    const created = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Receiving reject test',
      items: [{ skuId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.receivingTransaction.update({
      id: created.id,
      warehouseId,
      supplierId,
      notes: created.notes ?? undefined,
      items: [{ skuId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.receivingTransaction.reject({ id: created.id, message: 'Rejecting this entry' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'receiving_transaction', resourceId: rejected.id, action: 'REJECT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('approves a receiving transaction and creates putaway lines', async () => {
    const created = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Receiving approve test',
      items: [{ skuId, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.receivingTransaction.update({
      id: created.id,
      warehouseId,
      supplierId,
      notes: created.notes ?? undefined,
      items: [{ skuId, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.receivingTransaction.approve({ id: created.id, message: 'Approved' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const putawayCount = await prisma.putawayLine.count({
      where: { documentId: approved.id, transactionType: 'RECEIVING' },
    });
    expect(putawayCount).toBe(2);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'receiving_transaction', resourceId: approved.id, action: 'APPROVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });
});
