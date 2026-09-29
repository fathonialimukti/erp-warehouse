import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  deleteTestRole,
  deleteTestUser,
} from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const supplierIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "supplier@read",
    "supplier@create",
    "supplier@update",
    "supplier@delete",
  ]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Supplier Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });
});

afterAll(async () => {
  if (supplierIds.length > 0) {
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
  }
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("supplier router", () => {
  it("creates, updates, and deletes a supplier", async () => {
    const created = await caller.supplier.create({
      name: "Test Supplier",
      code: `SUP-${randomUUID()}`,
      email: "supplier@example.com",
    });
    expect(created.name).toBe("Test Supplier");
    supplierIds.push(created.id);

    const updated = await caller.supplier.update({
      id: created.id,
      name: "Updated Supplier",
      code: created.code ?? `SUP-${randomUUID()}`,
    });
    expect(updated.name).toBe("Updated Supplier");

    const deleted = await caller.supplier.delete({ id: updated.id });
    expect(deleted.success).toBe(true);
    supplierIds.pop();
  });
});
