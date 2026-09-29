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
let notificationId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["warehouse@read"]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Notification Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const notification = await prisma.notification.create({
    data: {
      userId: actorUserId,
      createdById: actorUserId,
      title: "Test Notification",
      message: "Integration test notification",
      type: "INFO",
      targetType: "SYSTEM",
    },
  });
  notificationId = notification.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { id: notificationId } });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("notification router", () => {
  it("lists, marks as read, and counts unread notifications", async () => {
    const result = await caller.notification.list({
      page: 1,
      limit: 10,
      unreadOnly: true,
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    const countBefore = await caller.notification.unreadCount();
    expect(countBefore.count).toBeGreaterThanOrEqual(1);

    const updated = await caller.notification.markAsRead({
      id: notificationId,
    });
    expect(updated.isRead).toBe(true);

    const countAfter = await caller.notification.unreadCount();
    expect(countAfter.count).toBeLessThanOrEqual(countBefore.count);
  });
});
