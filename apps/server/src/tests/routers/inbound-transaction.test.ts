import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestSku, seedTestPalletType, seedTestUser, seedTestWarehouse } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let palletTypeId: string;
let warehouseId: string;
const createdTransactionIds: string[] = []; 

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'warehouse_transaction_read',
    'warehouse_transaction_create',
    'warehouse_transaction_update',
    'warehouse_transaction_delete',
    'inbound_transaction@approve',
    'inbound_transaction@approve',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Inbound Transaction Test Actor',
  });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const palletType = await seedTestPalletType(sku.id);
  palletTypeId = palletType.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdTransactionIds.length > 0) {
    await prisma.inboundTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } });
  }
  await prisma.pallet.deleteMany({ where: { palletTypeId } });
  await prisma.palletType.delete({ where: { id: palletTypeId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('inbound transaction router', () => {
  it('creates a draft inbound transaction and logs activity', async () => {
    const transaction = await caller.inboundTransaction.create({
      warehouseId,
      sender: 'Supplier A',
      reference: 'REF-1',
      notes: 'Inbound create test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 2,
        },
      ],
      approvalHistory: [],
    });

    expect(transaction.approvalStatus).toBe('DRAFT');
    expect(transaction.items.length).toBe(1);
    const transactionItem = transaction.items[0];
    if (!transactionItem) {
      throw new Error('Expected created transaction to contain an item');
    }
    expect(transactionItem.quantity).toBe(2);

    createdTransactionIds.push(transaction.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'inbound_transaction',
        resourceId: transaction.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a draft inbound transaction and logs activity', async () => {
    const created = await caller.inboundTransaction.create({
      warehouseId,
      sender: 'Supplier B',
      reference: 'REF-2',
      notes: 'Inbound update test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 1,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    const updated = await caller.inboundTransaction.update({
      warehouseId,
      currentId: created.id,
      notes: 'Updated inbound notes',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 3,
        },
      ],
      approvalStatus: 'DRAFT',
      approvalHistory: [],
    });

    expect(updated.notes).toBe('Updated inbound notes');
    const updatedItem = updated.items[0];
    if (!updatedItem) {
      throw new Error('Expected updated transaction to contain an item');
    }
    expect(updatedItem.quantity).toBe(3);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'inbound_transaction',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('proposes and rejects an inbound transaction and logs activity', async () => {
    const created = await caller.inboundTransaction.create({
      warehouseId,
      sender: 'Supplier C',
      reference: 'REF-3',
      notes: 'Inbound reject test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 1,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    const proposed = await caller.inboundTransaction.propose({ id: created.id, message: 'Ready to approve' });
    expect(proposed.approvalStatus).toBe('PROPOSED');

    const rejected = await caller.inboundTransaction.reject({ id: created.id, message: 'Rejecting this entry' });
    expect(rejected.approvalStatus).toBe('REJECTED');

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'inbound_transaction',
        resourceId: rejected.id,
        action: 'REJECT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('approves an inbound transaction and creates pallets', async () => {
    const created = await caller.inboundTransaction.create({
      warehouseId,
      sender: 'Supplier D',
      reference: 'REF-4',
      notes: 'Inbound approve test',
      items: [
        {
          skuId,
          palletTypeId,
          quantity: 2,
        },
      ],
      approvalHistory: [],
    });

    createdTransactionIds.push(created.id);

    await caller.inboundTransaction.propose({ id: created.id });
    const approved = await caller.inboundTransaction.approve({ id: created.id, message: 'Approved' });

    expect(approved.approvalStatus).toBe('APPROVED');
    const totalPallets = approved.items.reduce((sum, item) => sum + item.pallets.length, 0);
    expect(totalPallets).toBe(2);
    const approvedItem = approved.items[0];
    if (!approvedItem) {
      throw new Error('Expected approved transaction to contain an item');
    }

    const pallets = await prisma.pallet.findMany({ where: { inboundTransactionItemId: approvedItem.id } });
    expect(pallets.length).toBe(2);
    expect(pallets.every((pallet) => pallet.status === 'AVAILABLE')).toBe(true);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'inbound_transaction',
        resourceId: approved.id,
        action: 'APPROVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
