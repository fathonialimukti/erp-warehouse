import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestPalletType,
  seedTestSku,
  seedTestUser,
  seedTestWarehouse,
} from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let skuId: string;
let palletTypeId: string;
const createdTransactionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'found@read',
    'found@create',
    'found@update',
    'found@delete',
    'found@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Found Transaction Test Actor',
  });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const sku = await seedTestSku();
  skuId = sku.id;
  const palletType = await seedTestPalletType(sku.id);
  palletTypeId = palletType.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdTransactionIds.length > 0) {
    await prisma.foundTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  await prisma.pallet.deleteMany({ where: { palletTypeId } });
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('found transaction router', () => {
  it('creates a draft found transaction and logs activity', async () => {
    const transaction = await caller.foundTransaction.create({
      warehouseId,
      foundReason: 'Inventory Check',
      reference: 'FOUND-1',
      notes: 'Found create test',
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'found_transaction', resourceId: transaction.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('updates a draft found transaction to proposed and logs activity', async () => {
    const created = await caller.foundTransaction.create({
      warehouseId,
      reference: 'FOUND-2',
      notes: 'Found update test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    const updated = await caller.foundTransaction.update({
      id: created.id,
      warehouseId,
      reference: created.reference ?? undefined,
      notes: 'Found proposed test',
      items: [{ skuId, palletTypeId, quantity: 3 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');
    const updatedItem = updated.items[0];
    if (!updatedItem) throw new Error('Expected updated transaction to contain an item');
    expect(Number(updatedItem.quantity)).toBe(3);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'found_transaction', resourceId: updated.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('rejects a proposed found transaction and logs activity', async () => {
    const created = await caller.foundTransaction.create({
      warehouseId,
      reference: 'FOUND-3',
      notes: 'Found reject test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.foundTransaction.update({
      id: created.id,
      warehouseId,
      reference: created.reference ?? undefined,
      notes: created.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.foundTransaction.reject({ id: created.id, message: 'Reject found' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'found_transaction', resourceId: rejected.id, action: 'REJECT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('approves a proposed found transaction and creates putaway lines', async () => {
    const created = await caller.foundTransaction.create({
      warehouseId,
      reference: 'FOUND-4',
      notes: 'Found approve test',
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.foundTransaction.update({
      id: created.id,
      warehouseId,
      reference: created.reference ?? undefined,
      notes: created.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.foundTransaction.approve({ id: created.id, message: 'Approve found' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const putawayCount = await prisma.putawayLine.count({
      where: { documentId: approved.id, transactionType: 'FOUND' },
    });
    expect(putawayCount).toBe(2);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'found_transaction', resourceId: approved.id, action: 'APPROVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });
});
