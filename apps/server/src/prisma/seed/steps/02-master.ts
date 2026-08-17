import type { DbClient } from "../../../lib/prisma.js";
import { ensureWarehouses } from "../catalog/warehouse.js";
import { allSkuRows } from "../catalog/skus.js";
import { SUPPLIERS } from "../catalog/partners.js";

/**
 * Ids of master-data rows created by this step, keyed by business code.
 * Carriers/distributors are NOT modeled in the schema — they are free-text
 * strings on shipment/receiving docs, handled in later steps.
 */
export interface MasterIds {
  warehouse: Record<string, string>;
  sku: Record<string, string>;
  supplier: Record<string, string>;
}

/** Idempotent: warehouses (address-only update), SKUs, suppliers. */
export async function seedMaster(db: DbClient): Promise<MasterIds> {
  const warehouse = await ensureWarehouses(db);

  for (const s of allSkuRows()) {
    await db.sku.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { ...s },
    });
  }
  const skuRows = await db.sku.findMany({
    where: { code: { in: allSkuRows().map((s) => s.code) } },
    select: { code: true, id: true },
  });
  // codes are non-null: filtered by `in` over the seed codes above
  const sku = Object.fromEntries(skuRows.map((r) => [r.code!, r.id]));

  for (const s of SUPPLIERS) {
    await db.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s },
    });
  }
  const supplierRows = await db.supplier.findMany({
    where: { code: { in: SUPPLIERS.map((s) => s.code) } },
    select: { code: true, id: true },
  });
  // codes are non-null: filtered by `in` over the seed codes above
  const supplier = Object.fromEntries(supplierRows.map((r) => [r.code!, r.id]));

  return { warehouse, sku, supplier };
}
