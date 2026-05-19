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
    'loss@read',
    'loss@create',
    'loss@update',
    'loss@delete',
    'loss@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Loss Transaction Test Actor',
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
    await prisma.stockMovement.deleteMany({ where: { documentId: { in: createdTransactionIds } } });
    await prisma.lossTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('loss transaction router', () => {
  it('creates a draft loss transaction and logs activity', async () => {
    const transaction = await caller.lossTransaction.create({
      warehouseId,
      lossReason: 'Damaged goods',
      notes: 'Loss create test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'loss_transaction', resourceId: transaction.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('updates a draft loss transaction to proposed and logs activity', async () => {
    const created = await caller.lossTransaction.create({
      warehouseId,
      lossReason: 'Damaged goods',
      notes: 'Loss update test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    const updated = await caller.lossTransaction.update({
      id: created.id,
      warehouseId,
      lossReason: created.lossReason ?? undefined,
      reference: created.reference ?? undefined,
      notes: 'Loss proposed test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'loss_transaction', resourceId: updated.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('rejects a proposed loss transaction and logs activity', async () => {
    const created = await caller.lossTransaction.create({
      warehouseId,
      lossReason: 'Damaged goods',
      notes: 'Loss reject test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.lossTransaction.update({
      id: created.id,
      warehouseId,
      lossReason: created.lossReason ?? undefined,
      notes: created.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.lossTransaction.reject({ id: created.id, message: 'Reject loss' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'loss_transaction', resourceId: rejected.id, action: 'REJECT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('approves a proposed loss transaction and logs activity', async () => {
    const created = await caller.lossTransaction.create({
      warehouseId,
      lossReason: 'Damaged goods',
      notes: 'Loss approve test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.lossTransaction.update({
      id: created.id,
      warehouseId,
      lossReason: created.lossReason ?? undefined,
      notes: created.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.lossTransaction.approve({ id: created.id, message: 'Approve loss' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'loss_transaction', resourceId: approved.id, action: 'APPROVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });
});

