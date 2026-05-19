
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, seedTestWarehouse, seedTestSku, seedTestPalletType, seedTestStorageLocation, seedTestPallet, deleteTestRole, deleteTestUser, deleteTestWarehouse, deleteTestSku, deleteTestPalletType, deleteTestStorageLocation } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let skuId: string;
let palletTypeId: string;
let fromLocationId: string;
let toLocationId: string;
let palletId: string;
const transferIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['subinventory-transfer@read', 'subinventory-transfer@create', 'subinventory-transfer@update', 'subinventory-transfer@delete']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Subinventory Transfer Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const sku = await seedTestSku();
  skuId = sku.id;
  const palletType = await seedTestPalletType(skuId);
  palletTypeId = palletType.id;
  const fromLocation = await seedTestStorageLocation(warehouseId);
  fromLocationId = fromLocation.id;
  const toLocation = await seedTestStorageLocation(warehouseId);
  toLocationId = toLocation.id;
  const pallet = await seedTestPallet({ palletTypeId, storageLocationId: fromLocationId, status: 'AVAILABLE' });
  palletId = pallet.id;
});

afterAll(async () => {
  if (transferIds.length > 0) {
    await prisma.subinventoryTransfer.deleteMany({ where: { id: { in: transferIds } } });
  }
  await prisma.pallet.deleteMany({ where: { id: palletId } });
  await deleteTestPalletType(palletTypeId);
  await deleteTestSku(skuId);
  await deleteTestStorageLocation(fromLocationId);
  await deleteTestStorageLocation(toLocationId);
  await deleteTestWarehouse(warehouseId);
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('subinventory transfer router', () => {
  it('creates, updates, and deletes a subinventory transfer', async () => {
    const created = await caller.subinventoryTransfer.create({
      warehouseId,
      transferReason: 'Move pallet',
      reference: 'TO-1',
      notes: 'Move pallet notes',
      items: [{ palletId, fromLocationId, toLocationId }],
      approvalHistory: [],
    });
    expect(created.items.length).toBe(1);
    transferIds.push(created.id);

    const updated = await caller.subinventoryTransfer.update({
      id: created.id,
      warehouseId,
      transferReason: 'Move pallet updated',
      reference: 'TO-2',
      notes: 'Notes updated',
      items: [{ palletId, fromLocationId, toLocationId }],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });
    expect(updated.transferReason).toBe('Move pallet updated');

    const deleted = await caller.subinventoryTransfer.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    transferIds.pop();
  });
});
