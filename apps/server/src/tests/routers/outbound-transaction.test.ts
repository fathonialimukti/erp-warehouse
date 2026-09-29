import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestWarehouse,
  seedTestSku,
  seedTestStorageLocation,
  seedTestPallet,
  deleteTestRole,
  deleteTestUser,
  deleteTestWarehouse,
  deleteTestSku,
  deleteTestStorageLocation,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let skuId: string;
let storageLocationId: string;
let palletId: string;
let shipmentId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["transaction@dispatch"]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Outbound Dispatch Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const location = await seedTestStorageLocation(warehouseId);
  storageLocationId = location.id;
  const sku = await seedTestSku();
  skuId = sku.id;
  const pallet = await seedTestPallet({
    skuId,
    storageLocationId,
    status: "AVAILABLE",
  });
  palletId = pallet.id;
  const shipment = await prisma.shipment.create({
    data: {
      warehouseId,
      createdById: actorUserId,
      reference: "OUTBOUND DISPATCH TEST",
      approvalStatus: "APPROVED",
    },
  });
  shipmentId = shipment.id;
  await prisma.pickLine.create({
    data: {
      transactionType: "SHIPMENT",
      documentId: shipmentId,
      palletId,
      fromLocationId: storageLocationId,
    },
  });
});

afterAll(async () => {
  await prisma.pickLine.deleteMany({ where: { documentId: shipmentId } });
  await prisma.shipment.deleteMany({ where: { id: shipmentId } });
  await prisma.pallet.deleteMany({ where: { id: palletId } });
  await deleteTestSku(skuId);
  await deleteTestStorageLocation(storageLocationId);
  await deleteTestWarehouse(warehouseId);
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("outbound transaction dispatch router", () => {
  it("submits a dispatch assignment and takes the pallet out of storage", async () => {
    const result = await caller.transaction.dispatch.submitAssignment({
      transactionType: "SHIPMENT",
      outboundTransactionId: shipmentId,
      assignments: [{ outboundTransactionItemId: "item-1", palletId }],
    });
    expect(result.success).toBe(true);
    expect(result.assignments[0]?.status).toBe("COMPLETED");

    const updatedPallet = await prisma.pallet.findUnique({
      where: { id: palletId },
    });
    expect(updatedPallet?.storageLocationId).toBeNull();

    const updatedShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });
    expect(updatedShipment?.dispatchStatus).toBe("COMPLETED");
  });

  it("returns assignment data with the pallet tagged to its item", async () => {
    const data = await caller.transaction.dispatch.getAssignmentData({
      transactionType: "SHIPMENT",
      outboundTransactionId: shipmentId,
    });
    expect(data.transactionType).toBe("SHIPMENT");
    expect(Array.isArray(data.items)).toBe(true);
    expect(Array.isArray(data.availablePallets)).toBe(true);
  });
});
