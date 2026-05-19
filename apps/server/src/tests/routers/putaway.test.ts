import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestPalletType,
  seedTestSku,
  seedTestStorageLocation,
  seedTestSupplier,
  seedTestUser,
  seedTestWarehouse,
} from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let storageLocationId: string;
let storageLocationIdTwo: string;
let skuId: string;
let palletTypeId: string;
let supplierId: string;
const createdTransactionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'receiving@read',
    'receiving@create',
    'receiving@update',
    'receiving@approve',
    'putaway@read',
    'putaway@complete',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `putaway-actor-${randomUUID()}@example.com`,
    name: 'Putaway Test Actor',
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
  const supplier = await seedTestSupplier();
  supplierId = supplier.id;

  actorUserId = actor.id;
  actorRoleId = role.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdTransactionIds.length > 0) {
    await prisma.stockMovement.deleteMany({ where: { documentId: { in: createdTransactionIds } } });
    await prisma.receivingTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  await prisma.pallet.deleteMany({ where: { palletTypeId } });
  await prisma.storageLocation.deleteMany({ where: { warehouseId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.supplier.delete({ where: { id: supplierId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('putaway router', () => {
  it('lists putaway lines for an approved receiving transaction', async () => {
    const receiving = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Putaway list test',
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(receiving.id);

    await caller.receivingTransaction.update({
      id: receiving.id,
      warehouseId,
      supplierId,
      notes: receiving.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });
    await caller.receivingTransaction.approve({ id: receiving.id });

    const result = await caller.putaway.list({ documentId: receiving.id, transactionType: 'RECEIVING' });
    expect(result.data.length).toBe(2);
    expect(result.data.every((line) => line.status === 'PENDING')).toBe(true);
  });

  it('completes a putaway line and assigns pallet to storage location', async () => {
    const receiving = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Putaway complete test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(receiving.id);

    await caller.receivingTransaction.update({
      id: receiving.id,
      warehouseId,
      supplierId,
      notes: receiving.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });
    await caller.receivingTransaction.approve({ id: receiving.id });

    const lines = await caller.putaway.list({ documentId: receiving.id, transactionType: 'RECEIVING' });
    const line = lines.data[0];
    if (!line) throw new Error('Expected a putaway line');

    const completed = await caller.putaway.complete({
      id: line.id,
      storageLocationId,
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.storageLocationId).toBe(storageLocationId);

    const pallet = await prisma.pallet.findUnique({ where: { id: completed.palletId } });
    expect(pallet?.storageLocationId).toBe(storageLocationId);
  });

  it('rejects completing a putaway line that is already completed', async () => {
    const receiving = await caller.receivingTransaction.create({
      warehouseId,
      supplierId,
      notes: 'Putaway already done test',
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdTransactionIds.push(receiving.id);

    await caller.receivingTransaction.update({
      id: receiving.id,
      warehouseId,
      supplierId,
      notes: receiving.notes ?? undefined,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalStatus: 'PROPOSED',
      approvalHistory: [],
    });
    await caller.receivingTransaction.approve({ id: receiving.id });

    const lines = await caller.putaway.list({ documentId: receiving.id, transactionType: 'RECEIVING' });
    const line = lines.data[0];
    if (!line) throw new Error('Expected a putaway line');

    await caller.putaway.complete({ id: line.id, storageLocationId: storageLocationIdTwo });

    await expect(
      caller.putaway.complete({ id: line.id, storageLocationId: storageLocationIdTwo }),
    ).rejects.toThrow();
  });
});
