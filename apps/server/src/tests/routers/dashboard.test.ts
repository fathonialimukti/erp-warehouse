import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { prisma } from "../../lib/prisma.js";
import {
  seedRoleWithPermissions,
  seedTestUser,
  deleteTestRole,
  deleteTestUser,
} from "../helpers/seed.js";

let actorRoleId: string;
let actorUserId: string;
let caller: ReturnType<typeof createCaller>;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(["warehouse@read"]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Dashboard Actor",
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

describe("dashboard router", () => {
  it("returns summary and warehouse allocations", async () => {
    const summary = await caller.dashboard.summary();
    expect(summary.pallets).toBeDefined();
    expect(summary.pallets.total).toBeDefined();
    expect(summary.pallets.available).toBeDefined();
    expect(summary.pallets.notAvailable).toBeDefined();
    expect(summary.pendingApprovals).toBeDefined();
    expect(summary.pendingApprovals.total).toBeDefined();
    expect(summary.pendingApprovals.breakdown).toBeDefined();
    expect(summary.execution).toBeDefined();
    expect(summary.monthlyActivity).toBeDefined();
    expect(summary.prevMonthActivity).toBeDefined();

    const allocations = await caller.dashboard.warehouseAllocations();
    expect(Array.isArray(allocations)).toBe(true);
  });

  /**
   * Regression: utilisation was counted as `status = "FULL"`, but that column is
   * only ever written by a human on the location form. Nothing operational
   * touches it, so a warehouse full of pallets reported 0%.
   *
   * Occupancy must be derived from the pallet relation.
   */
  describe("warehouseAllocations utilisation", () => {
    const whId = `test-wh-util-${randomUUID()}`;

    const makeLocation = async (status: "ACTIVE" | "FULL") =>
      prisma.storageLocation.create({
        data: { id: `test-loc-${randomUUID()}`, warehouseId: whId, status },
      });

    const occupiedWith = async (status: "ACTIVE" | "FULL") => {
      const location = await makeLocation(status);
      await prisma.pallet.create({
        data: { skuId, storageLocationId: location.id, status: "AVAILABLE" },
      });
    };

    let skuId: string;

    beforeAll(async () => {
      await prisma.warehouse.create({
        data: { id: whId, name: `test-wh-util-${randomUUID()}`, address: "t" },
      });
      skuId = (
        await prisma.sku.create({
          data: { name: `test-util-sku-${randomUUID()}`, baseUnit: "kg" },
        })
      ).id;

      await occupiedWith("ACTIVE"); // occupied
      await occupiedWith("ACTIVE"); // occupied
      await occupiedWith("FULL"); // occupied — the pallet relation wins
      await makeLocation("ACTIVE"); // empty
      await makeLocation("FULL"); // empty — manual flag must NOT fake occupancy
    });

    afterAll(async () => {
      await prisma.pallet.deleteMany({ where: { skuId } });
      await prisma.storageLocation.deleteMany({ where: { warehouseId: whId } });
      await prisma.warehouse.delete({ where: { id: whId } });
      await prisma.sku.delete({ where: { id: skuId } });
    });

    it("counts occupancy from the pallet relation, not the status flag", async () => {
      const allocations = await caller.dashboard.warehouseAllocations();
      const row = allocations.find((a) => a.warehouseId === whId);

      expect(row).toBeDefined();
      // 5 locations seeded, 3 of them holding a pallet.
      expect(row!.total).toBe(5);
      expect(row!.used).toBe(3);
      expect(row!.rate).toBe(60);
    });

    it("is non-zero whenever locations hold pallets", async () => {
      const allocations = await caller.dashboard.warehouseAllocations();
      const row = allocations.find((a) => a.warehouseId === whId);
      expect(row!.rate).toBeGreaterThan(0);
    });

    it("counts a location with no pallet as unoccupied", async () => {
      const allocations = await caller.dashboard.warehouseAllocations();
      const row = allocations.find((a) => a.warehouseId === whId);
      // The lone FULL-but-empty location is excluded from `used`; the empty
      // ACTIVE one is too. Both stay in `total`.
      expect(row!.total).toBe(5);
      expect(row!.used).toBeLessThan(row!.total);
    });
  });
});
