import { prisma } from "../../../../server/src/lib/prisma.js";

/**
 * Playwright `globalTeardown` — deletes the rows the specs create by
 * name/code prefix. Uses the server's Prisma singleton (see global-setup.ts
 * for why `@prisma/client` is not importable from here).
 *
 * Scope note: this used to call `prisma.transaction.deleteMany(...)`. There is
 * no `Transaction` model — the schema has one model per document type — so
 * `prisma.transaction` was `undefined`, the first call threw, and the catch
 * below swallowed it. Every delete after it (pallets, suppliers, warehouses,
 * SKUs) never ran. Each delete is now independent, so one failure cannot skip
 * the rest.
 *
 * What this cannot clean: transaction documents. The specs fill faker
 * references into free-text fields; `document_number` is server-generated, so
 * there is no prefix to match. CI does not care (the database is seeded fresh
 * per run); a local run leaves transaction rows until the next `db:seed`.
 */
export default async function globalTeardown() {
  console.log("🧹 Global E2E teardown...");

  const attempt = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (e) {
      console.error(`⚠️  Teardown step "${label}" failed (non-fatal):`, e);
    }
  };

  try {
    await prisma.$connect();

    await attempt("pallets", () =>
      prisma.pallet.deleteMany({
        where: { palletNumber: { startsWith: "E2E-" } },
      }),
    );
    await attempt("suppliers", () =>
      prisma.supplier.deleteMany({
        where: { code: { startsWith: "E2E-" } },
      }),
    );
    // `E2E-WH-<timestamp>` is the name warehouse.spec.ts creates.
    await attempt("warehouses", () =>
      prisma.warehouse.deleteMany({
        where: {
          OR: [
            { name: { startsWith: "E2E-WH-" } },
            { code: { startsWith: "E2E-" } },
          ],
        },
      }),
    );
    await attempt("skus", () =>
      prisma.sku.deleteMany({ where: { code: { startsWith: "E2E-" } } }),
    );

    console.log("✓ Test data cleaned up");
  } catch (e) {
    console.error("⚠️  Teardown error (non-fatal):", e);
  } finally {
    await prisma.$disconnect();
  }

  console.log("✅ Global teardown complete");
}
