import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let logId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([]);
  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: "Activity Log Test Actor",
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const log = await prisma.activityLog.create({
    data: {
      action: "CREATE",
      userId: actor.id,
      resource: "activity_log_test",
      resourceId: `log-${randomUUID()}`,
      message: "Activity log route test",
      detail: { reason: "seed" },
    },
  });

  logId = log.id;
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { id: logId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe("activity log router", () => {
  it("lists activity logs", async () => {
    const result = await caller.activityLog.list({
      search: "Activity log route test",
      page: 1,
      limit: 10,
    });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.some((item) => item.id === logId)).toBe(true);
  });

  it("returns activity log detail", async () => {
    const item = await caller.activityLog.detail({ id: logId });

    expect(item.id).toBe(logId);
    expect(item.resource).toBe("activity_log_test");
    expect(item.user).toBeTruthy();
    expect(item.user.id).toBe(actorUserId);
  });
});
