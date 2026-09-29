import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../prisma/generated/client.js";

/**
 * Notification.targetType -> the model its targetId points at. A notification
 * whose target document no longer exists is, by definition, residue: the test
 * that created it cleaned up its own document but the notification row has no
 * FK to it.
 */
const NOTIFICATION_TARGET_MODEL = {
  RECEIVING: "receivingTransaction",
  WIP_COMPLETION: "wipCompletion",
  RMA_RECEIPT: "rmaReceipt",
  WIP_ISSUE: "wipIssue",
  SHIPMENT: "shipment",
  RETURN_TO_SUPPLIER: "returnToSupplier",
  DISPOSAL: "disposal",
  SUBINVENTORY_TRANSFER: "subinventoryTransfer",
  LOSS: "lossTransaction",
  FOUND: "foundTransaction",
  STOCK_COUNT: "stockCount",
  PURCHASE_ORDER: "purchaseOrder",
} as const satisfies Record<string, string>;

// setupFiles run per test file, so the sweep runs per file. The orphan
// notification pass costs ~12 queries and only gets interesting once fixtures
// have been written, so gate it to one pass per process.
let orphanPassDone = false;

const sweepOrphanNotifications = async (): Promise<number> => {
  if (orphanPassDone) return 0;
  orphanPassDone = true;

  const targets = await prisma.notification.findMany({
    where: { targetId: { not: null } },
    select: { id: true, targetType: true, targetId: true },
  });
  if (targets.length === 0) return 0;

  const live = new Map<string, Set<string>>();
  await Promise.all(
    (
      Object.keys(NOTIFICATION_TARGET_MODEL) as Array<
        keyof typeof NOTIFICATION_TARGET_MODEL
      >
    ).map(async (type) => {
      const model = NOTIFICATION_TARGET_MODEL[type];
      const delegate = prisma[model] as unknown as {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
      };
      const rows = await delegate.findMany({ select: { id: true } });
      live.set(type, new Set(rows.map((r) => r.id)));
    }),
  );

  const isModelled = (
    targetType: string,
  ): targetType is keyof typeof NOTIFICATION_TARGET_MODEL =>
    targetType in NOTIFICATION_TARGET_MODEL;

  const orphanIds = targets
    .filter((t) => {
      // SYSTEM/REORDER and any type not modelled here: leave alone, we cannot
      // prove the target is gone.
      if (!t.targetId || !isModelled(t.targetType)) return false;
      return !live.get(t.targetType)?.has(t.targetId);
    })
    .map((t) => t.id);

  if (orphanIds.length === 0) return 0;
  const { count } = await prisma.notification.deleteMany({
    where: { id: { in: orphanIds } },
  });
  return count;
};

/**
 * Single source of truth for "what counts as test residue".
 *
 * Shared with `src/scripts/cleanup-test-data.ts` (the manual janitor) on
 * purpose: that script had its own copy of these patterns and silently omitted
 * `permissions`, which is exactly how 220 `TEST_ROLE_PERMISSION_*` rows
 * accumulated on the demo database. One list, two callers, no drift.
 *
 * Every predicate matches ONLY what the test helpers in `helpers/seed.ts` and
 * the router tests can produce, verified by reading every `create` call under
 * `src/tests/`. The previous shapes were wider than that and could delete a
 * developer's own data:
 *   - `users.email endsWith "@example.com"` deleted ANY local part, so a real
 *     dev user `foo@example.com` was one suite run from gone. Now the local
 *     part must also start with a prefix a test actually uses.
 *   - `warehouses.name startsWith "Test Warehouse"` deleted a warehouse named
 *     "Test Warehouse Annex", and `address startsWith "123 Test"` matched any
 *     street starting with those three characters. Neither prefix is needed:
 *     those fixtures are all identified by a `TEST_` code.
 *
 * The cost of the narrow list is that a NEW test using a new naming prefix
 * leaks its fixture instead of being auto-swept. That is the right trade: a
 * leaked row is visible, a deleted dev row is not. When a test adds a prefix,
 * add it here in the same commit.
 *
 * `TEST_` is deliberately NOT used as a whole-segment prefix: Prisma compiles
 * `startsWith` to SQL `LIKE`, where `_` is a single-character wildcard, so
 * `startsWith: "TEST_WAREHOUSE"` also matches "Test Warehouse Annex". Every
 * literal below is a full hyphenated segment.
 *
 * Seeded demo data (WH01-WH03, the 10 real roles, the @aetherglo.com roster)
 * matches none of these.
 */

/** Local-part prefixes every test-file user email is built from. */
const TEST_USER_EMAIL_PREFIXES = [
  "actor-", // seedTestActor + most router tests
  "TEST_USER-", // seedTestUser default
  "ai-query-",
  "ai-warehouse-",
  "assistant-actor-",
  "assistant-denied-",
  "auth-", // auth.test.ts
  "dependent-",
  "knowledge-actor-",
  "low-perm-",
  "settings-actor-",
  "settings-noperm-",
  "updated-",
] as const;

export const RESIDUE_FILTERS = {
  // A test email is `one of the prefixes above` + `@example.com`. The n8n
  // probe in auth.test.ts is the one fixture on the demo domain; it is
  // deleted by that test's own afterAll and only swept here if that run died.
  users: {
    OR: [
      ...TEST_USER_EMAIL_PREFIXES.map((prefix) => ({
        email: { startsWith: prefix, endsWith: "@example.com" },
      })),
      { email: { startsWith: "n8n-", endsWith: "@aetherglo.com" } },
    ],
  } satisfies Prisma.UserWhereInput,
  roles: {
    name: { startsWith: "TEST_ROLE-", mode: "insensitive" },
  } satisfies Prisma.RoleWhereInput,
  permissions: {
    name: { startsWith: "TEST_ROLE_PERMISSION", mode: "insensitive" },
  } satisfies Prisma.PermissionWhereInput,
  warehouses: {
    OR: [
      // By CODE, not name: the router tests tag codes
      // (TEST_WAREHOUSE_CREATE_…, TEST_WAREHOUSE_…). Codes are machine
      // identifiers, so the `_` wildcard in SQL LIKE is harmless here — the
      // human-written NAME is what a developer collides with, and every name
      // clause below ends in a literal character.
      { code: { startsWith: "TEST_WAREHOUSE", mode: "insensitive" } },
      { code: { startsWith: "E2E-", mode: "insensitive" } },
      // `seedTestWarehouse` → name "TEST_WAREHOUSE-<rand>". The trailing
      // hyphen is a literal, so "Test Warehouse Annex" (a SPACE there)
      // cannot match.
      { name: { startsWith: "TEST_WAREHOUSE-", mode: "insensitive" } },
      { name: { startsWith: "E2E-WH-", mode: "insensitive" } },
      { name: { equals: "E2E Test Warehouse", mode: "insensitive" } },
      // warehouse-layout.test.ts and dashboard.test.ts create untagged rows.
      { name: { equals: "Layout Warehouse", mode: "insensitive" } },
      { name: { startsWith: "test-wh-util-", mode: "insensitive" } },
    ],
  } satisfies Prisma.WarehouseWhereInput,
  skus: {
    OR: [
      { name: { startsWith: "TEST_SKU-", mode: "insensitive" } },
      { name: { startsWith: "E2E Test", mode: "insensitive" } },
      { name: { startsWith: "test-util-sku-", mode: "insensitive" } },
      // Exact fixture names — NOT a prefix, so a real "Test SKU Pro" survives.
      { name: { equals: "Test SKU", mode: "insensitive" } },
      { name: { equals: "Test Product", mode: "insensitive" } },
      { code: { startsWith: "E2E-", mode: "insensitive" } },
    ],
  } satisfies Prisma.SkuWhereInput,
  suppliers: {
    OR: [
      { name: { startsWith: "TEST_SUPPLIER-", mode: "insensitive" } },
      { name: { startsWith: "E2E Test", mode: "insensitive" } },
      { code: { startsWith: "E2E-", mode: "insensitive" } },
      // supplier.test.ts creates these exact names, then renames to
      // "Updated Supplier" — a prefix would also match a real one.
      { name: { equals: "Test Supplier", mode: "insensitive" } },
      { name: { equals: "Updated Supplier", mode: "insensitive" } },
    ],
  } satisfies Prisma.SupplierWhereInput,
};

/**
 * Deletes fixture rows the suite left behind, so a run against the shared dev
 * database is residue-neutral.
 *
 * Every test file already cleans up its own fixtures. This is the backstop for
 * the failure modes that actually bit us:
 *  - a fixture whose id was tracked in a single overwritten variable
 *    (`warehouse.test.ts` kept one `warehouseId` for three created warehouses)
 *    leaked one `TEST_WAREHOUSE_CREATE_*` row per run until the unfiltered
 *    /warehouse list was 100% test junk;
 *  - approval notifications are the worst case, because test actors hold REAL
 *    `@approve` permissions (helpers/seed.ts upserts them by name), so
 *    `notifyApprovalEvent` delivered to the seeded demo users and left rows
 *    behind with no FK to the deleted test document. That put 55 identical
 *    "Loss awaiting approval" notifications on the Admin bell.
 *
 * Leaks are silent — no test fails — so the guard belongs next to the
 * connection, not in each file.
 */
export const sweepTestResidue = async (): Promise<void> => {
  const removed: string[] = [];

  // A FK Restrict from a transaction table can block a warehouse/SKU/supplier
  // delete when a test died mid-file. Never let the guard fail a green suite:
  // report and move on so the next run can retry.
  const attempt = async (
    label: string,
    run: () => Promise<{ count: number }>,
  ) => {
    try {
      const { count } = await run();
      if (count > 0) removed.push(`${label}=${count}`);
    } catch (error) {
      console.warn(
        `[test-residue] could not sweep ${label}: ${(error as Error).message}`,
      );
    }
  };

  // Users first: they reference TEST_ROLE-* roles (ON DELETE SET NULL).
  await attempt("users", () =>
    prisma.user.deleteMany({ where: RESIDUE_FILTERS.users }),
  );
  await attempt("roles", () =>
    prisma.role.deleteMany({ where: RESIDUE_FILTERS.roles }),
  );
  await attempt("permissions", () =>
    prisma.permission.deleteMany({ where: RESIDUE_FILTERS.permissions }),
  );
  await attempt("warehouses", () =>
    prisma.warehouse.deleteMany({ where: RESIDUE_FILTERS.warehouses }),
  );
  await attempt("skus", () =>
    prisma.sku.deleteMany({ where: RESIDUE_FILTERS.skus }),
  );
  await attempt("suppliers", () =>
    prisma.supplier.deleteMany({ where: RESIDUE_FILTERS.suppliers }),
  );
  await attempt("orphan notifications", async () => ({
    count: await sweepOrphanNotifications(),
  }));

  if (removed.length > 0) {
    console.log(`[test-residue] swept leftover fixtures: ${removed.join(" ")}`);
  }
};
