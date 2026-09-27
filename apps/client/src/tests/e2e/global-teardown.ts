import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function globalTeardown() {
  console.log("🧹 Global E2E teardown...");

  try {
    await prisma.$connect();

    // Clean up test data created by E2E tests
    // Delete in FK-safe order
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { documentNumber: { startsWith: "E2E-" } },
          { documentNumber: { startsWith: "SMOKE-" } },
          { documentNumber: { startsWith: "SHIPMENT-" } },
        ],
      },
    });

    await prisma.pallet.deleteMany({
      where: { palletNumber: { startsWith: "E2E-" } },
    });

    await prisma.supplier.deleteMany({
      where: { code: { startsWith: "E2E-" } },
    });

    await prisma.warehouse.deleteMany({
      where: { code: { startsWith: "E2E-" } },
    });

    await prisma.sku.deleteMany({
      where: { code: { startsWith: "E2E-" } },
    });

    console.log("✓ Test data cleaned up");
  } catch (e) {
    console.error("⚠️  Teardown error (non-fatal):", e);
  } finally {
    await prisma.$disconnect();
  }

  console.log("✅ Global teardown complete");
}
