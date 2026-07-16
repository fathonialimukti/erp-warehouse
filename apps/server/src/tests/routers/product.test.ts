import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestSku,
  seedTestPallet,
  deleteTestRole,
  deleteTestUser,
  deleteTestSku,
} from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string | null = null;
let palletId: string | null = null;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'product@read',
    'product@create',
    'product@update',
    'product@delete',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Product Test Actor',
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (palletId) {
    await prisma.pallet.deleteMany({ where: { id: palletId } });
  }
  if (skuId) {
    await deleteTestSku(skuId);
  }
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('product router', () => {
  it('creates a finished-good product and logs activity', async () => {
    const code = `TEST_PRODUCT_${randomUUID()}`;
    const product = await caller.product.create({
      code,
      name: 'Test Product',
      baseUnit: 'pcs',
      packageName: 'Box',
      packagesPerPallet: 10,
      quantityPerPackage: 1,
      packageUnit: 'pcs',
    });

    expect(product.code).toBe(code);
    expect(product.type).toBe('FINISHED_GOOD');

    skuId = product.id;

    const activity = await prisma.activityLog.findFirst({
      where: { resource: 'product', resourceId: product.id, action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).toBeTruthy();
  });

  it('deletes a product with no pallets on-hand', async () => {
    const code = `TEST_PRODUCT_DEL_${randomUUID()}`;
    const product = await caller.product.create({
      code,
      name: 'Test Product Delete',
      baseUnit: 'pcs',
      packageName: 'Box',
      packagesPerPallet: 10,
      quantityPerPackage: 1,
      packageUnit: 'pcs',
    });

    const result = await caller.product.delete({ id: product.id });
    expect(result.success).toBe(true);

    const deleted = await prisma.sku.findUnique({ where: { id: product.id } });
    expect(deleted).toBeNull();
  });

  it('blocks deletion of a product that still has pallets (CONFLICT)', async () => {
    const code = `TEST_PRODUCT_BLOCK_${randomUUID()}`;
    const product = await caller.product.create({
      code,
      name: 'Test Product Blocked',
      packageName: 'Box',
      packagesPerPallet: 10,
      quantityPerPackage: 1,
      packageUnit: 'pcs',
    });

    const pallet = await seedTestPallet({ skuId: product.id });
    palletId = pallet.id;

    await expect(caller.product.delete({ id: product.id })).rejects.toThrow();

    // Product must remain because it still has on-hand pallets
    const stillThere = await prisma.sku.findUnique({ where: { id: product.id } });
    expect(stillThere).toBeTruthy();

    await prisma.pallet.deleteMany({ where: { id: pallet.id } });
    palletId = null;
    await prisma.sku.delete({ where: { id: product.id } });
  });
});
