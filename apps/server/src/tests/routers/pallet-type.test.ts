import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestSku, seedTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
const createdPalletTypeIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'pallet_type_read',
    'pallet_type_create',
    'pallet_type_update',
    'pallet_type_delete',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Pallet Type Test Actor',
  });

  const sku = await seedTestSku();
  skuId = sku.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdPalletTypeIds.length > 0) {
    await prisma.palletType.deleteMany({ where: { id: { in: createdPalletTypeIds } } });
  }
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('pallet type router', () => {
  it('creates a pallet type and logs activity', async () => {
    const id = `TEST_PALLET_TYPE_CREATE_${randomUUID()}`;

    const palletType = await caller.palletType.create({
      id,
      name: 'Test Pallet Type Create',
      skuId,
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageName: 'carton',
      packageUnit: 'kg',
    });

    expect(palletType.id).toBe(id);
    expect(palletType.name).toBe('Test Pallet Type Create');
    expect(palletType.sku.id).toBe(skuId);

    createdPalletTypeIds.push(palletType.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'pallet_type',
        resourceId: palletType.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a pallet type and logs activity', async () => {
    const id = `TEST_PALLET_TYPE_UPDATE_${randomUUID()}`;
    const created = await caller.palletType.create({
      id,
      name: 'Test Pallet Type Update',
      skuId,
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageName: 'carton',
      packageUnit: 'kg',
    });

    const newId = `TEST_PALLET_TYPE_UPDATED_${randomUUID()}`;
    const updated = await caller.palletType.update({
      id: created.id,
      newId,
      name: 'Test Pallet Type Updated',
      skuId,
      packagesPerPallet: 2,
      quantityPerPackage: 2,
      packageName: 'carton',
      packageUnit: 'kg',
    });

    expect(updated.id).toBe(newId);
    expect(updated.name).toBe('Test Pallet Type Updated');
    expect(updated.packagesPerPallet).toBe(2);

    createdPalletTypeIds.push(updated.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'pallet_type',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('deletes a pallet type and logs activity', async () => {
    const id = `TEST_PALLET_TYPE_DELETE_${randomUUID()}`;
    const created = await caller.palletType.create({
      id,
      name: 'Test Pallet Type Delete',
      skuId,
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageName: 'carton',
      packageUnit: 'kg',
    });

    const response = await caller.palletType.delete({ id: created.id });
    expect(response.success).toBe(true);

    const deleted = await prisma.palletType.findUnique({ where: { id: created.id } });
    expect(deleted).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'pallet_type',
        resourceId: created.id,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
