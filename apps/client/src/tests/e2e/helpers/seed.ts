import { prisma } from "../../../../../server/src/lib/prisma.js";

/**
 * Seed baseline test data for E2E tests.
 * Idempotent — only creates records if they don't exist.
 *
 * NOTE: CI does NOT run this module. `.github/workflows/e2e.yml` runs the real
 * seeder (`bun run src/prisma/seed.ts` in apps/server) instead, so CI exercises
 * the same dataset a developer gets from `db:seed` — including the demo roster
 * the specs log in with. This helper only tops up a database that has never
 * been seeded at all.
 *
 * Prisma comes from the SERVER package (`@prisma/client` is not installed under
 * apps/client and never was — see the sibling `global-setup.ts` for the full
 * story). It is a value import, not a type-only one, so the fixtures actually
 * run.
 */

/** @param db — server Prisma client; passed in so the caller owns the lifecycle. */
export async function seedTestData(db: typeof prisma) {
  console.log("🌱 Seeding E2E test data...");

  // Create warehouse if none exist
  const warehouseCount = await db.warehouse.count();
  if (warehouseCount === 0) {
    await db.warehouse.create({
      data: {
        name: "E2E Test Warehouse",
        code: "E2E-WH-001",
        address: "123 Test Street",
      },
    });
    console.log("✓ Created test warehouse");
  } else {
    console.log(`✓ Warehouses already exist (${warehouseCount})`);
  }

  // Create SKU if none exist
  const skuCount = await db.sku.count();
  if (skuCount === 0) {
    await db.sku.create({
      data: {
        code: "E2E-SKU-001",
        name: "E2E Test Product",
        description: "Test product for E2E tests",
        unit: "PCS",
      },
    });
    console.log("✓ Created test SKU");
  } else {
    console.log(`✓ SKUs already exist (${skuCount})`);
  }

  // Create supplier if none exist
  const supplierCount = await db.supplier.count();
  if (supplierCount === 0) {
    await db.supplier.create({
      data: {
        name: "E2E Test Supplier",
        code: "E2E-SUP-001",
        contactPerson: "Test Contact",
        email: "test@supplier.com",
        phone: "+1234567890",
      },
    });
    console.log("✓ Created test supplier");
  } else {
    console.log(`✓ Suppliers already exist (${supplierCount})`);
  }

  console.log("✅ E2E test data seeding complete");
}

// Runnable directly (`bun src/tests/e2e/helpers/seed.ts`). Without this guard
// the module only exported `seedTestData`, so the workflow step that invoked
// this file was a silent no-op — it exited 0 having seeded nothing.
if (import.meta.main) {
  try {
    await seedTestData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
