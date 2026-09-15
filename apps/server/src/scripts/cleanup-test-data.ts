// Cleans up test data left behind by integration/E2E tests.
// Deletes warehouses, SKUs, suppliers, users, roles, and related records
// that match known test naming patterns.
// Usage: bun src/scripts/cleanup-test-data.ts [--yes]
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const CONFIRM = process.argv.includes('--yes');

async function countOrDelete(
  label: string,
  model: keyof typeof prisma,
  where: object,
  deleteFn: () => Promise<{ count: number }>,
): Promise<number> {
  // @ts-expect-error dynamic model access
  const items = await prisma[model].findMany({ where, select: { id: true, name: true } });
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
  console.log('🔍 Scanning for test data...\n');

  const patterns = {
    warehouses: {
      OR: [
        { name: { startsWith: 'Test Warehouse' } },
        { name: { startsWith: 'TEST_WAREHOUSE' } },
        { name: { startsWith: 'Updated Warehouse' } },
        { name: { startsWith: 'E2E Test Warehouse' } },
        { address: { startsWith: '123 Test' } },
        { address: { startsWith: '123 Delete' } },
        { address: { startsWith: '123 Update' } },
        { address: { startsWith: '456 Updat' } },
        { address: { startsWith: '123 Warehouse' } },
        { address: { startsWith: '456 Warehouse' } },
      ],
    },
    skus: {
      OR: [
        { name: { startsWith: 'TEST_SKU' } },
        { name: { startsWith: 'E2E Test Product' } },
        { description: { startsWith: 'Test SKU' } },
        { name: { startsWith: 'Test Product' } },
        { name: { startsWith: 'TEST_PRODUCT' } },
        { name: { startsWith: 'Test SKU' } },
        { name: 'Test Product Delete' },
        { name: 'Test Product Blocked' },
      ],
    },
    suppliers: {
      OR: [
        { name: { startsWith: 'TEST_SUPPLIER' } },
        { name: { startsWith: 'E2E Test Supplier' } },
        { name: { startsWith: 'Test Supplier' } },
      ],
    },
    users: {
      OR: [
        // Emails from test seeds always end in @example.com
        { email: { endsWith: '@example.com' } },
        // Named test actors created in beforeAll hooks
        { name: { contains: 'Actor' } },
        { name: { contains: 'Test' } },
      ],
    },
    roles: {
      OR: [
        { name: { startsWith: 'TEST_ROLE' } },
        { description: { startsWith: 'Generated test role' } },
      ],
    },
  };

  let total = 0;

  // Activity logs referencing test warehouses
  const testWarehouses = await prisma.warehouse.findMany({
    where: patterns.warehouses,
    select: { id: true },
  });
  if (testWarehouses.length > 0) {
    const whIds = testWarehouses.map((w) => w.id);
    const logs = await prisma.activityLog.count({
      where: { resource: 'warehouse', resourceId: { in: whIds } },
    });
    if (logs > 0) {
      console.log(`  ActivityLogs (warehouse): ${logs} found`);
      if (CONFIRM) {
        const r = await prisma.activityLog.deleteMany({
          where: { resource: 'warehouse', resourceId: { in: whIds } },
        });
        console.log(`    deleted: ${r.count}`);
      }
      total += logs;
    }
  }

  total += await countOrDelete('Warehouses', 'warehouse', patterns.warehouses, () =>
    prisma.warehouse.deleteMany({ where: patterns.warehouses }),
  );
  total += await countOrDelete('SKUs', 'sku', patterns.skus, () =>
    prisma.sku.deleteMany({ where: patterns.skus }),
  );
  total += await countOrDelete('Suppliers', 'supplier', patterns.suppliers, () =>
    prisma.supplier.deleteMany({ where: patterns.suppliers }),
  );
  total += await countOrDelete('Users', 'user', patterns.users, () =>
    prisma.user.deleteMany({ where: patterns.users }),
  );
  total += await countOrDelete('Roles', 'role', patterns.roles, () =>
    prisma.role.deleteMany({ where: patterns.roles }),
  );

  console.log(`\n${total === 0 ? '✅ No test data found.' : `📊 Total items: ${total}`}`);

  if (!CONFIRM && total > 0) {
    console.log('\n⚠️  Dry run — no data was deleted. Re-run with --yes to confirm deletion.');
  } else if (CONFIRM && total > 0) {
    console.log('\n🧹 Cleanup complete.');
  }
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
