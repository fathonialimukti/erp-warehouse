import { PrismaClient } from "@prisma/client";

/**
 * Seed baseline test data for E2E tests.
 * Idempotent — only creates records if they don't exist.
 *
 * @param prisma — PrismaClient instance (passed in so the caller controls
 *   connection lifecycle; the global setup creates and disconnects it).
 */
export async function seedTestData(prisma: PrismaClient) {
  console.log("🌱 Seeding E2E test data...");

  // Create warehouse if none exist
  const warehouseCount = await prisma.warehouse.count();
  if (warehouseCount === 0) {
    await prisma.warehouse.create({
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
  const skuCount = await prisma.sku.count();
  if (skuCount === 0) {
    await prisma.sku.create({
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
  const supplierCount = await prisma.supplier.count();
  if (supplierCount === 0) {
    await prisma.supplier.create({
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
