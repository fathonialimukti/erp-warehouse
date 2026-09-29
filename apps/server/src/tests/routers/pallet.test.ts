import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestSku,
  seedTestWarehouse,
  seedTestStorageLocation,
  deleteTestRole,
  deleteTestUser,
  deleteTestSku,
  deleteTestWarehouse,
  deleteTestStorageLocation,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let skuId: string;
let warehouseId: string;
let storageLocationId: string;
const palletIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["warehouse@read"]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Pallet Actor",
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
  const location = await seedTestStorageLocation(warehouseId);
  storageLocationId = location.id;
});

afterAll(async () => {
  if (palletIds.length) {
    await prisma.pallet.deleteMany({ where: { id: { in: palletIds } } });
  }
  await deleteTestSku(skuId);
  await deleteTestStorageLocation(storageLocationId);
  await deleteTestWarehouse(warehouseId);
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("pallet router", () => {
  it("creates, updates, and deletes a pallet", async () => {
    const created = await caller.pallet.create({
      skuId,
      storageLocationId,
      status: "AVAILABLE",
    });
    palletIds.push(created.id);
    expect(created.status).toBe("AVAILABLE");

    const updated = await caller.pallet.update({
      id: created.id,
      skuId,
      storageLocationId,
      status: "NOT_AVAILABLE",
    });
    expect(updated.status).toBe("NOT_AVAILABLE");

    const removed = await caller.pallet.delete({ id: updated.id });
    expect(removed.success).toBe(true);
    palletIds.pop();
  });
});
