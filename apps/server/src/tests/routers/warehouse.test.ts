import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
// Every warehouse this file creates, not just the last one. A single
// module-scoped id leaked one `TEST_WAREHOUSE_CREATE_*` row into the shared
// dev DB on every suite run — 55 of them had piled up by 2026-09-28 and made
// the /warehouse list (ordered by createdAt DESC) 100% test junk.
const createdWarehouseIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "warehouse@read",
    "warehouse@create",
    "warehouse@update",
    "warehouse@delete",
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: "Warehouse Test Actor",
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });
});

afterAll(async () => {
  if (createdWarehouseIds.length > 0) {
    await prisma.warehouse.deleteMany({
      where: { id: { in: createdWarehouseIds } },
    });
  }
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe("warehouse router", () => {
  it("creates a warehouse and logs activity", async () => {
    const code = `TEST_WAREHOUSE_CREATE_${randomUUID()}`;
    const warehouse = await caller.warehouse.warehouse.create({
      code,
      name: "Test Warehouse Create",
      address: "123 Test Address",
      totalCapacity: 100,
    });

    expect(warehouse.code).toBe(code);
    expect(warehouse.name).toBe("Test Warehouse Create");
    expect(warehouse.address).toBe("123 Test Address");

    createdWarehouseIds.push(warehouse.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "warehouse",
        resourceId: warehouse.id,
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("updates a warehouse and logs activity", async () => {
    const code = `TEST_WAREHOUSE_UPDATE_${randomUUID()}`;
    const created = await caller.warehouse.warehouse.create({
      code,
      name: "Test Warehouse Update",
      address: "123 Update Address",
    });

    createdWarehouseIds.push(created.id);

    const updatedCode = `TEST_WAREHOUSE_UPDATED_${randomUUID()}`;
    const updated = await caller.warehouse.warehouse.update({
      currentId: created.id,
      code: updatedCode,
      name: "Test Warehouse Updated",
      address: "456 Updated Address",
      totalCapacity: 200,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.code).toBe(updatedCode);
    expect(updated.name).toBe("Test Warehouse Updated");
    expect(updated.totalCapacity).toBe(200);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "warehouse",
        resourceId: updated.id,
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("deletes a warehouse and logs activity", async () => {
    const code = `TEST_WAREHOUSE_DELETE_${randomUUID()}`;
    const created = await caller.warehouse.warehouse.create({
      code,
      name: "Test Warehouse Delete",
      address: "123 Delete Address",
    });

    const response = await caller.warehouse.warehouse.delete({
      id: created.id,
    });
    expect(response.success).toBe(true);

    const deletedWarehouse = await prisma.warehouse.findUnique({
      where: { id: created.id },
    });
    expect(deletedWarehouse).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "warehouse",
        resourceId: created.id,
        action: "DELETE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });
});
