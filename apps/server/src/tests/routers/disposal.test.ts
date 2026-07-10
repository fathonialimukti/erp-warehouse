
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, seedTestSku, seedTestWarehouse, deleteTestRole, deleteTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
const disposalIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['disposal@read', 'disposal@create', 'disposal@update', 'disposal@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Disposal Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
});

afterAll(async () => {
  if (disposalIds.length > 0) {
    await prisma.disposal.deleteMany({ where: { id: { in: disposalIds } } });
  }
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('disposal router', () => {
  it('creates, updates, and deletes a disposal record', async () => {
    const created = await caller.disposal.create({
      warehouseId,
      disposalReason: 'Test disposal',
      reference: 'REF-DS',
      notes: 'Test notes',
      items: [{ skuId, quantity: 1, details: 'detail' }],
      approvalHistory: [],
    });
    expect(created.approvalStatus).toBe('DRAFT');
    expect(created.items.length).toBe(1);
    disposalIds.push(created.id);

    const updated = await caller.disposal.update({
      id: created.id,
      warehouseId,
      disposalReason: 'Updated disposal',
      reference: 'REF-DS-2',
      notes: 'Updated notes',
      items: [{ skuId, quantity: 2, details: 'detail' }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });
    expect(updated.disposalReason).toBe('Updated disposal');
    expect(Number(updated.items[0]?.quantity)).toBe(2);

    const response = await caller.disposal.delete({ id: updated.id });
    expect(response.success).toBe(true);
    disposalIds.pop();
  });
});
