// Cleans up test data left behind by integration/E2E tests.
// Deletes warehouses, SKUs, suppliers, users, roles, permissions, and orphaned
// notifications that match known test naming patterns.
//
// This is the MANUAL janitor for E2E leftovers and killed runs. The vitest
// suite sweeps itself automatically after every test file — see
// `src/tests/helpers/cleanup.ts`, which also owns the shared pattern list so
// the two cannot drift (this script previously omitted `permissions`, and 220
// `TEST_ROLE_PERMISSION_*` rows survived on the demo database because of it).
//
// Usage: bun src/scripts/cleanup-test-data.ts [--yes]
import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { RESIDUE_FILTERS } from "../tests/helpers/cleanup.js";

const CONFIRM = process.argv.includes("--yes");

async function countOrDelete(
  label: string,
  model: keyof typeof prisma,
  where: object,
  deleteFn: () => Promise<{ count: number }>,
): Promise<number> {
  // @ts-expect-error dynamic model access
  const items = await prisma[model].findMany({
    where,
    select: { id: true, name: true },
  });
  if (items.length === 0) {
    console.log(`  ${label}: none found`);
    return 0;
  }
  console.log(`  ${label}: ${items.length} found`);
  for (const item of items.slice(0, 5)) {
    console.log(`    - ${(item as { name?: string }).name ?? item.id}`);
  }
  if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);

  if (CONFIRM) {
    const result = await deleteFn();
    console.log(`    deleted: ${result.count}`);
    return result.count;
  }
  return items.length;
}

async function main() {
  console.log("🔍 Scanning for test data...\n");

  // Single source of truth — shared with the vitest suite's own sweep.
  const patterns = RESIDUE_FILTERS;

  let total = 0;

  // Activity logs referencing test warehouses
  const testWarehouses = await prisma.warehouse.findMany({
    where: patterns.warehouses,
    select: { id: true },
  });
  if (testWarehouses.length > 0) {
    const whIds = testWarehouses.map((w) => w.id);
    const logs = await prisma.activityLog.count({
      where: { resource: "warehouse", resourceId: { in: whIds } },
    });
    if (logs > 0) {
      console.log(`  ActivityLogs (warehouse): ${logs} found`);
      if (CONFIRM) {
        const r = await prisma.activityLog.deleteMany({
          where: { resource: "warehouse", resourceId: { in: whIds } },
        });
        console.log(`    deleted: ${r.count}`);
      }
      total += logs;
    }
  }

  total += await countOrDelete(
    "Warehouses",
    "warehouse",
    patterns.warehouses,
    () => prisma.warehouse.deleteMany({ where: patterns.warehouses }),
  );
  total += await countOrDelete("SKUs", "sku", patterns.skus, () =>
    prisma.sku.deleteMany({ where: patterns.skus }),
  );
  total += await countOrDelete(
    "Suppliers",
    "supplier",
    patterns.suppliers,
    () => prisma.supplier.deleteMany({ where: patterns.suppliers }),
  );
  total += await countOrDelete("Users", "user", patterns.users, () =>
    prisma.user.deleteMany({ where: patterns.users }),
  );
  total += await countOrDelete("Roles", "role", patterns.roles, () =>
    prisma.role.deleteMany({ where: patterns.roles }),
  );
  // role_has_permissions cascades from both, but TEST_ROLE_PERMISSION_* rows
  // created by role.test.ts were referenced by nothing at all.
  total += await countOrDelete(
    "Permissions",
    "permission",
    patterns.permissions,
    () => prisma.permission.deleteMany({ where: patterns.permissions }),
  );

  console.log(
    `\n${total === 0 ? "✅ No test data found." : `📊 Total items: ${total}`}`,
  );

  if (!CONFIRM && total > 0) {
    console.log(
      "\n⚠️  Dry run — no data was deleted. Re-run with --yes to confirm deletion.",
    );
  } else if (CONFIRM && total > 0) {
    console.log("\n🧹 Cleanup complete.");
  }
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
