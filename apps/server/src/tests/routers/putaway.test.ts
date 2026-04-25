import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestPalletType, seedTestSku, seedTestUser, seedTestWarehouse } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let skuId: string;
let palletTypeId: string;
const createdInboundIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'warehouse_transaction_read',
    'warehouse_transaction_create',
    'warehouse_transaction_update',
    'approval_approve',
    'putaway_read',
    'putaway_assign',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `putaway-actor-${randomUUID()}@example.com`,
    name: 'Putaway Test Actor',
  });

  const warehouse = await seedTestWarehouse();
  const sku = await seedTestSku();
  const palletType = await seedTestPalletType(sku.id);

  actorUserId = actor.id;
  actorRoleId = role.id;
  warehouseId = warehouse.id;
  skuId = sku.id;
  palletTypeId = palletType.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdInboundIds.length > 0) {
    await prisma.inboundTransaction.deleteMany({ where: { id: { in: createdInboundIds } } });
  }

  await prisma.pallet.deleteMany({ where: { palletTypeId } });
  await prisma.storageLocation.deleteMany({ where: { warehouseId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.palletType.deleteMany({ where: { id: palletTypeId } });
  await prisma.sku.deleteMany({ where: { id: skuId } });
  await prisma.user.deleteMany({ where: { id: actorUserId } });
  await prisma.role.deleteMany({ where: { id: actorRoleId } });
});

describe('putaway router', () => {
  it('returns deterministic suggested assignments for approved inbound pallets', async () => {
    const locAId = `LOC-A-${randomUUID()}`;
    const locBId = `LOC-B-${randomUUID()}`;

    await prisma.storageLocation.createMany({
      data: [
        { id: locBId, warehouseId, status: 'ACTIVE' },
        { id: locAId, warehouseId, status: 'ACTIVE' },
      ],
    });

    const inbound = await caller.inboundTransaction.create({
      sender: 'Supplier Putaway',
      reference: 'PUTAWAY-REF-1',
      warehouseId,
      items: [{ skuId, palletTypeId, quantity: 2 }],
      approvalHistory: [],
    });
    createdInboundIds.push(inbound.id);

    await caller.inboundTransaction.propose({ id: inbound.id });
    await caller.inboundTransaction.approve({ id: inbound.id });

    const preview = await caller.putaway.getAssignmentPreview({ inboundTransactionId: inbound.id });

    expect(preview.pendingPalletCount).toBe(2);
    expect(preview.availableLocationCount).toBeGreaterThanOrEqual(2);
    expect(preview.hasInsufficientLocations).toBe(false);
    expect(preview.suggestedAssignments).toHaveLength(2);
    const firstAssignment = preview.suggestedAssignments[0];
    const secondAssignment = preview.suggestedAssignments[1];
    expect(firstAssignment).toBeTruthy();
    expect(secondAssignment).toBeTruthy();
    if (!firstAssignment || !secondAssignment) {
      throw new Error('Expected two suggested assignments');
    }
    expect(firstAssignment.storageLocationId <= secondAssignment.storageLocationId).toBe(true);
  });

  it('assigns all suggested pallets to storage locations in one confirmation', async () => {
    const inbound = await caller.inboundTransaction.create({
      sender: 'Supplier Putaway 2',
      reference: 'PUTAWAY-REF-2',
      warehouseId,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdInboundIds.push(inbound.id);

    const locationId = `LOC-C-${randomUUID()}`;
    await prisma.storageLocation.create({
      data: { id: locationId, warehouseId, status: 'ACTIVE' },
    });

    await caller.inboundTransaction.propose({ id: inbound.id });
    await caller.inboundTransaction.approve({ id: inbound.id });

    const preview = await caller.putaway.getAssignmentPreview({ inboundTransactionId: inbound.id });
    expect(preview.suggestedAssignments).toHaveLength(1);

    const result = await caller.putaway.assignSuggested({
      inboundTransactionId: inbound.id,
      assignments: preview.suggestedAssignments.map((item) => ({
        palletId: item.palletId,
        storageLocationId: item.storageLocationId,
      })),
      message: 'Putaway assigned from test',
    });

    expect(result.success).toBe(true);
    expect(result.assignedCount).toBe(1);

    const firstResultAssignment = result.assignments[0];
    expect(firstResultAssignment).toBeTruthy();
    if (!firstResultAssignment) {
      throw new Error('Expected one assignment result');
    }

    const assignedPallet = await prisma.pallet.findUnique({
      where: { id: firstResultAssignment.palletId },
    });
    expect(assignedPallet?.storageLocationId).toBe(firstResultAssignment.storageLocationId);
  });

  it('rejects preview for non-approved inbound transactions', async () => {
    const inbound = await caller.inboundTransaction.create({
      sender: 'Supplier Draft',
      reference: 'PUTAWAY-REF-3',
      warehouseId,
      items: [{ skuId, palletTypeId, quantity: 1 }],
      approvalHistory: [],
    });
    createdInboundIds.push(inbound.id);

    await expect(
      caller.putaway.getAssignmentPreview({ inboundTransactionId: inbound.id }),
    ).rejects.toThrow();
  });
});