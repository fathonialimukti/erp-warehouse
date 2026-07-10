
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
let stockMovementId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['stock-movement@read']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Stock Movement Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;

  const movement = await prisma.stockMovement.create({
    data: {
      transactionType: 'SHIPMENT',
      direction: 'OUT',
      documentId: 'DOC-1',
      documentNumber: 'DOCNUM-1',
      skuId,
      warehouseId,
      quantity: '1',
      signedQty: '-1',
      transactionDate: new Date(),
      postedById: actorUserId,
    },
  });
  stockMovementId = movement.id;
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { id: stockMovementId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('stock movement router', () => {
  it('lists stock movements and returns a detail record', async () => {
    const list = await caller.stockMovement.list({ page: 1, limit: 10, search: 'DOCNUM' });
    expect(list.data.length).toBeGreaterThanOrEqual(1);

    const detail = await caller.stockMovement.detail({ id: stockMovementId });
    expect(detail.id).toBe(stockMovementId);
  });
});
