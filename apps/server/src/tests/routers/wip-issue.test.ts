
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, seedTestSku, seedTestWarehouse, seedTestPalletType, deleteTestRole, deleteTestUser, deleteTestSku, deleteTestPalletType, deleteTestWarehouse } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let palletTypeId: string;
let warehouseId: string;
const issueIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['wip-issue@read', 'wip-issue@create', 'wip-issue@update', 'wip-issue@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'WIP Issue Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const sku = await seedTestSku();
  skuId = sku.id;
  const palletType = await seedTestPalletType(skuId);
  palletTypeId = palletType.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
});

afterAll(async () => {
  if (issueIds.length > 0) {
    await prisma.wipIssue.deleteMany({ where: { id: { in: issueIds } } });
  }
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('wip issue router', () => {
  it('creates, updates, and deletes a WIP issue record', async () => {
    const created = await caller.wipIssue.create({
      warehouseId,
      workOrderRef: 'WO-1',
      reference: 'REF-1',
      notes: 'Notes',
      items: [{ skuId, palletTypeId, quantity: 1, details: 'details' }],
      approvalHistory: [],
    });
    expect(created.items.length).toBe(1);
    issueIds.push(created.id);

    const updated = await caller.wipIssue.update({
      id: created.id,
      warehouseId,
      workOrderRef: 'WO-2',
      reference: 'REF-2',
      notes: 'Updated notes',
      items: [{ skuId, palletTypeId, quantity: 2, details: 'details' }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });
    expect(updated.workOrderRef).toBe('WO-2');

    const deleted = await caller.wipIssue.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    issueIds.pop();
  });
});
