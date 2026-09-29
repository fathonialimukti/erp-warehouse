import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const createdPermissionIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "permission@read",
    "permission@create",
    "permission@update",
    "permission@delete",
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: "Permission Test Actor",
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
  if (createdPermissionIds.length > 0) {
    await prisma.permission.deleteMany({
      where: { id: { in: createdPermissionIds } },
    });
  }
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe("permission router", () => {
  it("creates a permission and logs activity", async () => {
    const name = `TEST_PERMISSION_CREATE_${randomUUID()}`;
    const permission = await caller.accessControl.permission.create({
      name,
      description: "Permission create test",
    });

    expect(permission.id).toBeTruthy();
    expect(permission.name).toBe(name);

    createdPermissionIds.push(permission.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "permission",
        resourceId: permission.id,
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("updates a permission and logs activity", async () => {
    const name = `TEST_PERMISSION_UPDATE_${randomUUID()}`;
    const created = await caller.accessControl.permission.create({
      name,
      description: "To update",
    });
    createdPermissionIds.push(created.id);

    const updated = await caller.accessControl.permission.update({
      id: created.id,
      name: `${name}-UPDATED`,
      description: "Updated description",
    });

    expect(updated.name).toBe(`${name}-UPDATED`);
    expect(updated.description).toBe("Updated description");

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "permission",
        resourceId: updated.id,
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });

  it("deletes a permission and logs activity", async () => {
    const created = await caller.accessControl.permission.create({
      name: `TEST_PERMISSION_DELETE_${randomUUID()}`,
      description: "To delete",
    });

    const response = await caller.accessControl.permission.delete({
      id: created.id,
    });
    expect(response.success).toBe(true);

    const deletedPermission = await prisma.permission.findUnique({
      where: { id: created.id },
    });
    expect(deletedPermission).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: "permission",
        resourceId: created.id,
        action: "DELETE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(activity).toBeTruthy();
  });
});
