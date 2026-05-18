import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestPalletType, seedTestSku, seedTestStorageLocation, seedTestUser, seedTestWarehouse, seedTestPallet } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string | undefined;
let actorRoleId: string | undefined;
let warehouseId: string | undefined;
let storageLocationId: string | undefined;
let storageLocationTwoId: string | undefined;
let skuId: string | undefined;
let palletTypeId: string | undefined;
const createdTransactionIds: string[] = [];
const createdPalletIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'warehouse_transaction_read',
    'warehouse_transaction_create',
    'warehouse_transaction_update',
    'warehouse_transaction_delete',
    'outbound_transaction@approve',
    'outbound_transaction@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Outbound Transaction Test Actor',
  });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const location = await seedTestStorageLocation(warehouseId);
  storageLocationId = location.id;
  const locationTwo = await seedTestStorageLocation(warehouseId);
  storageLocationTwoId = locationTwo.id;
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
    await prisma.outboundTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  if (createdPalletIds.length > 0) {
    await prisma.pallet.deleteMany({ where: { id: { in: createdPalletIds } } });
  }
  if (palletTypeId) {
    await prisma.palletType.delete({ where: { id: palletTypeId } });
  }
  if (skuId) {
    await prisma.sku.delete({ where: { id: skuId } });
  }
  if (storageLocationId) {
    await prisma.storageLocation.delete({ where: { id: storageLocationId } });
  }
  if (storageLocationTwoId) {
    await prisma.storageLocation.delete({ where: { id: storageLocationTwoId } });
  }
  if (warehouseId) {
    await prisma.warehouse.delete({ where: { id: warehouseId } });
  }
  if (actorUserId) {
    await prisma.user.delete({ where: { id: actorUserId } });
  }
  if (actorRoleId) {
    await prisma.role.delete({ where: { id: actorRoleId } });
  }
});

describe('outbound transaction router', () => {
  it('creates a draft outbound transaction and logs activity', async () => {
    const palletOne = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    const palletTwo = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    createdPalletIds.push(palletOne.id, palletTwo.id);
    const palletIds = [palletOne.id, palletTwo.id];

    const transaction = await caller.outboundTransaction.create({
      notes: 'Outbound create test',
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);
    expect(transaction.items?.[0]?.quantity).toBe(2);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_pengeluaran',
        resourceId: transaction.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a draft outbound transaction to proposed and logs activity', async () => {
    const palletOne = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    const palletTwo = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    createdPalletIds.push(palletOne.id, palletTwo.id);
    const palletIds = [palletOne.id, palletTwo.id];

    const created = await caller.outboundTransaction.create({
      notes: 'Outbound update test',
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    const updated = await caller.outboundTransaction.update({
      id: created.id,
      notes: 'Outbound proposed test',
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_pengeluaran',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('rejects a proposed outbound transaction and logs activity', async () => {
    const palletOne = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    const palletTwo = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    createdPalletIds.push(palletOne.id, palletTwo.id);
    const palletIds = [palletOne.id, palletTwo.id];

    const created = await caller.outboundTransaction.create({
      notes: 'Outbound reject test',
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.outboundTransaction.update({
      id: created.id,
      notes: created.notes ?? undefined,
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.outboundTransaction.reject({ id: created.id, message: 'Rejecting outbound' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_pengeluaran',
        resourceId: rejected.id,
        action: 'REJECT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('approves a proposed outbound transaction and marks pallets not available', async () => {
    const palletOne = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    const palletTwo = await seedTestPallet({ palletTypeId: palletTypeId!, status: 'AVAILABLE' });
    createdPalletIds.push(palletOne.id, palletTwo.id);
    const palletIds = [palletOne.id, palletTwo.id];

    const created = await caller.outboundTransaction.create({
      notes: 'Outbound approve test',
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);
    await caller.outboundTransaction.update({
      id: created.id,
      notes: created.notes ?? undefined,
      items: [
        {
          skuId: skuId!,
          palletTypeId: palletTypeId!,
          quantity: 2,
          palletIds,
        },
      ],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.outboundTransaction.approve({ id: created.id, message: 'Approve outbound' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const pallets = await prisma.pallet.findMany({ where: { id: { in: palletIds } } });
    expect(pallets.every((pallet) => pallet.status === 'NOT_AVAILABLE')).toBe(true);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'transaksi_pengeluaran',
        resourceId: approved.id,
        action: 'APPROVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
