import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SEED_USERS } from "../../prisma/seed/catalog/users.js";
import { prisma } from "../../lib/prisma.js";
import { RESIDUE_FILTERS } from "./cleanup.js";

/**
 * The residue sweep runs against the SHARED dev database on every vitest run
 * and via the manual janitor (`scripts/cleanup-test-data.ts`). Its previous
 * shapes were wider than the test fixtures:
 *   - `users.email endsWith "@example.com"` matched ANY local part, so a
 *     developer's `foo@example.com` was one suite run from deleted;
 *   - `warehouses.name startsWith "Test Warehouse"` matched "Test Warehouse
 *     Annex", and `address startsWith "123 Test"` matched "123 Tester Road".
 * Neither turned anything red — the data was simply gone.
 *
 * Probe rows are created inside a transaction that is ALWAYS rolled back, and
 * matching runs through the real `RESIDUE_FILTERS` rather than a
 * reimplemented predicate, so this test cannot drift from the shipped filters.
 */
const RUN = randomUUID().slice(0, 8);

type WarehouseProbe = { name: string; code: string | null; address?: string };

const MUST_SWEEP: { users: string[]; warehouses: WarehouseProbe[] } = {
  users: [
    `actor-${RUN}@example.com`,
    `TEST_USER-${RUN}@example.com`,
    `ai-query-${RUN}@example.com`,
    `ai-warehouse-${RUN}@example.com`,
    `assistant-actor-${RUN}@example.com`,
    `assistant-denied-${RUN}@example.com`,
    `auth-${RUN}@example.com`,
    `dependent-${RUN}@example.com`,
    `knowledge-actor-${RUN}@example.com`,
    `low-perm-${RUN}@example.com`,
    `settings-actor-${RUN}@example.com`,
    `settings-noperm-${RUN}@example.com`,
    `updated-${RUN}@example.com`,
    `n8n-${RUN}@aetherglo.com`,
  ],
  warehouses: [
    // warehouse.test.ts / warehouse-crud.test.ts: names are "Test Warehouse
    // Create|Update|Updated|Delete|CRUD", codes are TEST_WAREHOUSE_*.
    {
      name: `Test Warehouse Create ${RUN}`,
      code: `TEST_WAREHOUSE_CREATE_${RUN}`,
    },
    { name: `Test Warehouse CRUD ${RUN}`, code: `TEST_WAREHOUSE_${RUN}` },
    // seedTestWarehouse: "TEST_WAREHOUSE-<rand>"
    { name: `TEST_WAREHOUSE-${RUN}`, code: null },
    { name: `E2E Test Warehouse ${RUN}`, code: `E2E-WH-${RUN}` },
    { name: `E2E-WH-17000000${RUN}`, code: null },
    // warehouse-layout.test.ts creates this exact name.
    { name: "Layout Warehouse", code: null },
    { name: `test-wh-util-${RUN}`, code: null },
  ],
};

const MUST_SPARE: { users: string[]; warehouses: WarehouseProbe[] } = {
  users: [
    // The regression: any @example.com local part used to be swept.
    `foo-${RUN}@example.com`,
    `someone.i.knew-${RUN}@example.com`,
    // A test-shaped local part on a real domain is still a real account.
    `actor-jane-${RUN}@acme-corp.com`,
  ],
  warehouses: [
    // The regression: a real warehouse whose name merely starts with the words
    // a test fixture used to start with, and real street addresses.
    { name: "Test Warehouse Annex", code: `WH-PROBE-A-${RUN}` },
    {
      name: `Overflow ${RUN}`,
      code: `WH-PROBE-B-${RUN}`,
      address: "123 Test Street",
    },
    {
      name: `Q4 Overflow ${RUN}`,
      code: `WH-PROBE-C-${RUN}`,
      address: "123 Tester Road",
    },
  ],
};

describe("test-residue filters are provably narrow", () => {
  it("collects only the test fixtures, never a developer's own rows", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        for (const email of [...MUST_SWEEP.users, ...MUST_SPARE.users]) {
          await tx.user.create({
            data: { name: "residue-probe", email, password: "x" },
          });
        }
        for (const wh of [...MUST_SWEEP.warehouses, ...MUST_SPARE.warehouses]) {
          await tx.warehouse.create({
            data: {
              name: wh.name,
              code: wh.code,
              address: wh.address ?? "probe",
              totalCapacity: 1,
            },
          });
        }

        for (const email of MUST_SWEEP.users) {
          const count = await tx.user.count({
            where: { AND: [RESIDUE_FILTERS.users, { email }] },
          });
          expect(count, `${email} should be swept`).toBe(1);
        }
        for (const email of MUST_SPARE.users) {
          const count = await tx.user.count({
            where: { AND: [RESIDUE_FILTERS.users, { email }] },
          });
          expect(count, `${email} must be spared`).toBe(0);
        }

        for (const wh of MUST_SWEEP.warehouses) {
          const count = await tx.warehouse.count({
            where: { AND: [RESIDUE_FILTERS.warehouses, { name: wh.name }] },
          });
          expect(count, `${wh.name} should be swept`).toBe(1);
        }
        for (const wh of MUST_SPARE.warehouses) {
          const count = await tx.warehouse.count({
            where: { AND: [RESIDUE_FILTERS.warehouses, { name: wh.name }] },
          });
          expect(count, `${wh.name} must be spared`).toBe(0);
        }

        // The seeded roster and the real demo warehouses must never match.
        const rosterHits = await tx.user.count({
          where: {
            AND: [
              RESIDUE_FILTERS.users,
              { email: { in: SEED_USERS.map((u) => u.email) } },
            ],
          },
        });
        expect(rosterHits).toBe(0);
        const demoWarehouseHits = await tx.warehouse.count({
          where: {
            AND: [
              RESIDUE_FILTERS.warehouses,
              { code: { in: ["WH01", "WH02", "WH03"] } },
            ],
          },
        });
        expect(demoWarehouseHits).toBe(0);

        // Throw to roll back: probe rows must not outlive this file.
        throw new Error("__rollback__");
      }),
    ).rejects.toThrow("__rollback__");
  });
});
