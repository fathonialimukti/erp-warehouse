import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let seededSkuId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["sku@read"]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: "SKU Test Actor",
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const sku = await prisma.sku.create({
    data: {
      code: `SKU_TEST_${randomUUID()}`,
      name: "Test SKU",
      type: "RAW_MATERIAL",
      packageName: "sack",
      packagesPerPallet: 10,
      quantityPerPackage: 25,
      packageUnit: "kg",
    },
  });
  seededSkuId = sku.id;
});

afterAll(async () => {
  await prisma.sku.deleteMany({ where: { id: seededSkuId } });
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe("sku router (read-only overview)", () => {
  it("lists SKUs with optional type filter", async () => {
    const all = await caller.sku.list({ page: 1, limit: 50 });
    expect(all.data.length).toBeGreaterThanOrEqual(1);

    const filtered = await caller.sku.list({
      page: 1,
      limit: 50,
      type: "RAW_MATERIAL",
    });
    expect(filtered.data.every((s) => s.type === "RAW_MATERIAL")).toBe(true);
  });

  it("returns a single SKU detail", async () => {
    const sku = await caller.sku.detail({ id: seededSkuId });
    expect(sku.id).toBe(seededSkuId);
    expect(sku.type).toBe("RAW_MATERIAL");
  });
});
