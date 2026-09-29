import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestSku,
  seedTestWarehouse,
  seedTestSupplier,
  deleteTestRole,
  deleteTestUser,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
let supplierId: string;
const transactionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "return-to-supplier@read",
    "return-to-supplier@create",
    "return-to-supplier@update",
    "return-to-supplier@delete",
  ]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Return Supplier Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const sku = await seedTestSku();
  skuId = sku.id;
  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;
  const supplier = await seedTestSupplier();
  supplierId = supplier.id;
});

afterAll(async () => {
  if (transactionIds.length > 0) {
    await prisma.returnToSupplier.deleteMany({
      where: { id: { in: transactionIds } },
    });
  }
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await prisma.supplier.delete({ where: { id: supplierId } });
  await prisma.sku.delete({ where: { id: skuId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("return to supplier router", () => {
  it("creates, updates, and deletes a return to supplier record", async () => {
    const created = await caller.returnToSupplier.create({
      warehouseId,
      supplierId,
      returnReason: "Return reason",
      reference: "RTS-1",
      notes: "Notes",
      items: [{ skuId, quantity: 1, details: "details" }],
      approvalHistory: [],
    });
    expect(created.items.length).toBe(1);
    transactionIds.push(created.id);

    const updated = await caller.returnToSupplier.update({
      id: created.id,
      warehouseId,
      supplierId,
      returnReason: "Return reason updated",
      reference: "RTS-2",
      notes: "Notes updated",
      items: [{ skuId, quantity: 2, details: "details" }],
      approvalStatus: "DRAFT",
      approvalHistory: [],
    });
    expect(updated.returnReason).toBe("Return reason updated");

    const deleted = await caller.returnToSupplier.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    transactionIds.pop();
  });
});
