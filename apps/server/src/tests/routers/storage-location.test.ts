import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  seedTestWarehouse,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let warehouseId: string;
let importWarehouseId: string | null = null;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "storage_location@read",
    "storage_location@create",
    "storage_location@update",
    "storage_location@delete",
    "storage_location@import",
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: "Storage Location Test Actor",
  });

  const warehouse = await seedTestWarehouse();
  warehouseId = warehouse.id;

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });
});

afterAll(async () => {
  if (warehouseId) {
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  }
  if (importWarehouseId) {
    await prisma.warehouse.deleteMany({ where: { id: importWarehouseId } });
  }
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe("storage location router", () => {
  it("creates a storage location and logs activity", async () => {
    const id = `TEST_LOCATION_CREATE_${randomUUID()}`;

    const location = await caller.warehouse.storageLocation.create({
      warehouseId,
      id,
      status: "ACTIVE",
    });

    expect(location.id).toBe(id);
    expect(location.warehouseId).toBe(warehouseId);
    expect(location.status).toBe("ACTIVE");

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "storage_location",
        resourceId: location.id,
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("updates a storage location and logs activity", async () => {
    const id = `TEST_LOCATION_UPDATE_${randomUUID()}`;
    await caller.warehouse.storageLocation.create({
      warehouseId,
      id,
      status: "ACTIVE",
    });

    const newId = `TEST_LOCATION_UPDATED_${randomUUID()}`;
    const updated = await caller.warehouse.storageLocation.update({
      currentId: id,
      id: newId,
      warehouseId,
      status: "MAINTENANCE",
    });

    expect(updated.id).toBe(newId);
    expect(updated.status).toBe("MAINTENANCE");

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "storage_location",
        resourceId: newId,
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("deletes a storage location and logs activity", async () => {
    const id = `TEST_LOCATION_DELETE_${randomUUID()}`;
    await caller.warehouse.storageLocation.create({
      warehouseId,
      id,
      status: "ACTIVE",
    });

    const response = await caller.warehouse.storageLocation.delete({ id });
    expect(response.success).toBe(true);

    const deleted = await prisma.storageLocation.findUnique({ where: { id } });
    expect(deleted).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "storage_location",
        resourceId: id,
        action: "DELETE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("imports storage locations and logs import activity", async () => {
    const importWarehouse = await seedTestWarehouse();
    importWarehouseId = importWarehouse.id;

    const rows = [
      { id: `TEST_LOCATION_IMPORT_A_${randomUUID()}` },
      { id: `TEST_LOCATION_IMPORT_B_${randomUUID()}` },
    ];

    const createResult = await caller.warehouse.storageLocation.importBatch({
      warehouseId: importWarehouseId,
      rows,
    });

    expect(createResult.created).toBe(2);
    expect(createResult.updated).toBe(0);
    expect(createResult.deleted).toBe(0);

    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error("Expected imported rows to include at least one row");
    }

    const importResult = await caller.warehouse.storageLocation.importBatch({
      warehouseId: importWarehouseId,
      rows: [{ id: firstRow.id }],
    });

    expect(importResult.created).toBe(0);
    expect(importResult.updated).toBe(1);
    expect(importResult.deleted).toBe(1);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "storage_location",
        resourceId: importWarehouseId,
        action: "IMPORT",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });
});
