import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestPalletType, seedTestSku, seedTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let palletTypeId: string;
const createdTransactionIds: string[] = [];

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
    name: 'Found Transaction Test Actor',
  });

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
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('found transaction router', () => {
  it('creates a draft found transaction and logs activity', async () => {
    const transaction = await caller.foundTransaction.create({
      findingType: 'Inventory Check',
      reference: 'FOUND-1',
      notes: 'Found create test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 2,
        },
      ],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'found_transaction',
        resourceId: transaction.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a draft found transaction to proposed and logs activity', async () => {
    const created = await caller.foundTransaction.create({
      findingType: 'Inventory Check',
      reference: 'FOUND-2',
      notes: 'Found update test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 1,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    const updated = await caller.foundTransaction.update({
      id: created.id,
      findingType: created.findingType,
      reference: created.reference,
      notes: 'Found proposed test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 3,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');
    expect(updated.items[0].quantity).toBe(3);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'found_transaction',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('rejects a proposed found transaction and logs activity', async () => {
    const created = await caller.foundTransaction.create({
      findingType: 'Inventory Check',
      reference: 'FOUND-3',
      notes: 'Found reject test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 1,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.foundTransaction.update({
      id: created.id,
      findingType: created.findingType,
      reference: created.reference,
      notes: created.notes,
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 1,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.foundTransaction.reject({ id: created.id, message: 'Reject found' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_temuan',
        resourceId: rejected.id,
        action: 'REJECT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('approves a proposed found transaction and creates pallets', async () => {
    const created = await caller.foundTransaction.create({
      findingType: 'Inventory Check',
      reference: 'FOUND-4',
      notes: 'Found approve test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 2,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.foundTransaction.update({
      id: created.id,
      findingType: created.findingType,
      reference: created.reference,
      notes: created.notes,
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 2,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.foundTransaction.approve({ id: created.id, message: 'Approve found' });

    expect(approved.approvalStatus).toBe('APPROVED');
    const totalPallets = approved.items.reduce((sum, item) => sum + item.pallets.length, 0);
    expect(totalPallets).toBe(2);
    expect(approved.items[0].pallets.length).toBe(2);

    const pallets = await prisma.pallet.findMany({ where: { foundTransactionItemId: approved.items[0].id } });
    expect(pallets.every((pallet) => pallet.status === 'AVAILABLE')).toBe(true);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_temuan',
        resourceId: approved.id,
        action: 'APPROVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
