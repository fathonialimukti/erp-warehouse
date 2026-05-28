import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const createdSkuIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'sku@read',
    'sku@create',
    'sku@update',
    'sku@delete',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'SKU Test Actor',
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdSkuIds.length > 0) {
    await prisma.sku.deleteMany({ where: { id: { in: createdSkuIds } } });
  }
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('sku router', () => {
  it('creates a SKU and logs activity', async () => {
    const code = `TEST_SKU_CREATE_${randomUUID()}`;
    const sku = await caller.sku.create({
      code,
      name: 'Test SKU Create',
      description: 'SKU create test',
      baseUnit: 'kg',
    });

    expect(sku.code).toBe(code);
    expect(sku.name).toBe('Test SKU Create');

    createdSkuIds.push(sku.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'sku',
        resourceId: sku.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it.skip('updates a SKU and logs activity', async () => {
    const code = `TEST_SKU_UPDATE_${randomUUID()}`;
    const created = await caller.sku.create({
      code,
      name: 'Test SKU Update',
      description: 'SKU update test',
      baseUnit: 'kg',
    });

    const updatedCode = `TEST_SKU_UPDATE_NEW_${randomUUID()}`;
    const updated = await caller.sku.update({
      currentId: created.id,
      code: updatedCode,
      name: 'Test SKU Updated',
      description: 'Updated SKU description',
      baseUnit: 'kg',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.code).toBe(updatedCode);
    expect(updated.name).toBe('Test SKU Updated');

    createdSkuIds.push(updated.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'sku',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it.skip('deletes a SKU and logs activity', async () => {
    const code = `TEST_SKU_DELETE_${randomUUID()}`;
    const created = await caller.sku.create({
      code,
      name: 'Test SKU Delete',
      description: 'SKU delete test',
      baseUnit: 'kg',
    });

    const response = await caller.sku.delete({ id: created.id });
    expect(response.success).toBe(true);

    const deletedSku = await prisma.sku.findUnique({ where: { id: created.id } });
    expect(deletedSku).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'sku',
        resourceId: created.id,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
