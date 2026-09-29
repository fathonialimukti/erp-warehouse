import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestStorageLocation,
  seedTestSku,
  seedTestPallet,
  deleteTestRole,
  deleteTestUser,
  deleteTestWarehouse,
  deleteTestStorageLocation,
  deleteTestSku,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let storageLocationId: string;
let skuId: string;
let palletId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["warehouse@read"]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Warehouse Layout Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      name: "Layout Warehouse",
      address: "123 Layout St",
      objectId: "TEST_OBJECT_ID",
    },
  });
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
});

afterAll(async () => {
  await prisma.pallet.deleteMany({ where: { id: palletId } });
  await deleteTestSku(skuId);
  await deleteTestStorageLocation(storageLocationId);
  await deleteTestWarehouse(warehouseId);
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("warehouse layout router", () => {
  it("returns a warehouse scene payload", async () => {
    const scene = await caller.warehouse.layout.getScene({ warehouseId });
    expect(scene.warehouseObjectId).toBe("TEST_OBJECT_ID");
    expect(Array.isArray(scene.locations)).toBe(true);
    expect(scene.locations.length).toBeGreaterThanOrEqual(1);
  });
});
