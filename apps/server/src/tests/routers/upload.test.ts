import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  deleteTestRole,
  deleteTestUser,
} from "../helpers/seed.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Upload Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });
});

afterAll(async () => {
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe("upload router", () => {
  it("uploads an image and returns a managed URL", async () => {
    const result = await caller.upload.image({
      folder: "users",
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    });

    expect(result.url).toContain("/uploads/users/");
  });
});
