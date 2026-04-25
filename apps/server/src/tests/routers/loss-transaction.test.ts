import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestPalletType, seedTestSku, seedTestUser, seedTestPallet } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let palletTypeId: string;
let palletId: string;
const createdTransactionIds: string[] = [];
const createdPalletIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'warehouse_transaction_read',
    'warehouse_transaction_create',
    'warehouse_transaction_update',
    'warehouse_transaction_delete',
    'approval_approve',
    'approval_reject',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Loss Transaction Test Actor',
  });

  const sku = await seedTestSku();
  skuId = sku.id;
  const palletType = await seedTestPalletType(sku.id);
  palletTypeId = palletType.id;
  const pallet = await seedTestPallet({ palletTypeId, status: 'AVAILABLE' });
  palletId = pallet.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdTransactionIds.length > 0) {
    await prisma.lossTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  if (createdPalletIds.length > 0) {
    await prisma.pallet.deleteMany({ where: { id: { in: createdPalletIds } } });
  }
  await prisma.pallet.delete({ where: { id: palletId } });
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('loss transaction router', () => {
  it('creates a draft loss transaction and logs activity', async () => {
    const pallet = await seedTestPallet({ palletTypeId, status: 'AVAILABLE' });
    createdPalletIds.push(pallet.id);

    const transaction = await caller.lossTransaction.create({
      lossReason: 'Damaged goods',
      notes: 'Loss create test',
      palletIds: [pallet.id],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.palletPivots.length).toBe(1);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'loss_transaction',
        resourceId: transaction.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a draft loss transaction to proposed and logs activity', async () => {
    const pallet = await seedTestPallet({ palletTypeId, status: 'AVAILABLE' });
    createdPalletIds.push(pallet.id);

    const created = await caller.lossTransaction.create({
      lossReason: 'Damaged goods',
      notes: 'Loss update test',
      palletIds: [pallet.id],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    const updated = await caller.lossTransaction.update({
      id: created.id,
      lossReason: created.lossReason,
      reference: created.reference ?? 'LOSS-REF',
      notes: 'Loss proposed test',
      palletIds: [pallet.id],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'loss_transaction',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('rejects a proposed loss transaction and logs activity', async () => {
    const pallet = await seedTestPallet({ palletTypeId, status: 'AVAILABLE' });
    createdPalletIds.push(pallet.id);

    const created = await caller.lossTransaction.create({
      lossReason: 'Damaged goods',
      notes: 'Loss reject test',
      palletIds: [pallet.id],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.lossTransaction.update({
      id: created.id,
      lossReason: created.lossReason,
      reference: created.reference ?? 'LOSS-REF',
      notes: created.notes,
      palletIds: [pallet.id],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.lossTransaction.reject({ id: created.id, message: 'Reject loss' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_kehilangan',
        resourceId: rejected.id,
        action: 'REJECT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('approves a proposed loss transaction and marks the pallet not available', async () => {
    const pallet = await seedTestPallet({ palletTypeId, status: 'AVAILABLE' });
    createdPalletIds.push(pallet.id);

    const created = await caller.lossTransaction.create({
      lossReason: 'Damaged goods',
      notes: 'Loss approve test',
      palletIds: [pallet.id],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.lossTransaction.update({
      id: created.id,
      lossReason: created.lossReason,
      reference: created.reference ?? 'LOSS-REF',
      notes: created.notes,
      palletIds: [pallet.id],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.lossTransaction.approve({ id: created.id, message: 'Approve loss' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const approvedPallet = await prisma.pallet.findUnique({ where: { id: pallet.id } });
    expect(approvedPallet?.status).toBe('NOT_AVAILABLE');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_kehilangan',
        resourceId: approved.id,
        action: 'APPROVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
