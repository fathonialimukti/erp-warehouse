import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestPalletType,
  seedTestSku,
  seedTestStorageLocation,
  seedTestUser,
  seedTestWarehouse,
  seedTestPallet,
} from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string | undefined;
let actorRoleId: string | undefined;
let warehouseId: string | undefined;
let storageLocationId: string | undefined;
let storageLocationIdTwo: string | undefined;
let skuId: string | undefined;
let palletTypeId: string | undefined;
const createdTransactionIds: string[] = [];
const createdPalletIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'shipment@read',
    'shipment@create',
    'shipment@update',
    'shipment@delete',
    'shipment@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Shipment Test Actor',
  });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const location = await seedTestStorageLocation(warehouseId);
  storageLocationId = location.id;
  const locationTwo = await seedTestStorageLocation(warehouseId);
  storageLocationIdTwo = locationTwo.id;
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
    await prisma.shipment.deleteMany({ where: { id: { in: createdTransactionIds } } });
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
  if (storageLocationIdTwo) {
    await prisma.storageLocation.delete({ where: { id: storageLocationIdTwo } });
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

describe('shipment router', () => {
  it('creates a draft shipment and logs activity', async () => {
    const transaction = await caller.shipment.create({
      warehouseId: warehouseId!,
      notes: 'Shipment create test',
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);
    expect(Number(transaction.items[0]?.quantity)).toBe(2);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'shipment', resourceId: transaction.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('updates a draft shipment to proposed and logs activity', async () => {
    const created = await caller.shipment.create({
      warehouseId: warehouseId!,
      notes: 'Shipment update test',
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    const updated = await caller.shipment.update({
      id: created.id,
      warehouseId: warehouseId!,
      notes: 'Shipment proposed test',
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    expect(updated.approvalStatus).toBe('PROPOSED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'shipment', resourceId: updated.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('rejects a proposed shipment and logs activity', async () => {
    const created = await caller.shipment.create({
      warehouseId: warehouseId!,
      notes: 'Shipment reject test',
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.shipment.update({
      id: created.id,
      warehouseId: warehouseId!,
      notes: created.notes ?? undefined,
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const rejected = await caller.shipment.reject({ id: created.id, message: 'Rejecting shipment' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'shipment', resourceId: rejected.id, action: 'REJECT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('approves a proposed shipment and creates pick lines for available pallets', async () => {
    // Pre-seed AVAILABLE pallets with a storage location so FIFO auto-pick can reserve them
    const palletOne = await seedTestPallet({
      palletTypeId: palletTypeId!,
      storageLocationId: storageLocationId!,
      status: 'AVAILABLE',
    });
    const palletTwo = await seedTestPallet({
      palletTypeId: palletTypeId!,
      storageLocationId: storageLocationIdTwo!,
      status: 'AVAILABLE',
    });
    createdPalletIds.push(palletOne.id, palletTwo.id);

    const created = await caller.shipment.create({
      warehouseId: warehouseId!,
      notes: 'Shipment approve test',
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(created.id);

    await caller.shipment.update({
      id: created.id,
      warehouseId: warehouseId!,
      notes: created.notes ?? undefined,
      items: [{ skuId: skuId!, palletTypeId: palletTypeId!, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });

    const approved = await caller.shipment.approve({ id: created.id, message: 'Approve shipment' });
    expect(approved.approvalStatus).toBe('APPROVED');

    const pickCount = await prisma.pickLine.count({
      where: { documentId: approved.id, transactionType: 'SHIPMENT' },
    });
    expect(pickCount).toBe(2);

    const reservedPallets = await prisma.pallet.findMany({
      where: { id: { in: [palletOne.id, palletTwo.id] } },
    });
    expect(reservedPallets.every((p) => p.status === 'NOT_AVAILABLE')).toBe(true);

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'shipment', resourceId: approved.id, action: 'APPROVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });
});
