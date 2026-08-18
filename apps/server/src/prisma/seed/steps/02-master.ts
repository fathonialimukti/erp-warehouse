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

/** Storage-location plan per warehouse (RACK/FLOOR counts). */
const LOCATION_PLAN: Record<string, { RACK: number; FLOOR: number }> = {
  WH01: { RACK: 216, FLOOR: 48 },
  WH02: { RACK: 0, FLOOR: 108 },
  WH03: { RACK: 324, FLOOR: 0 },
};

/**
 * Idempotent: warehouses (address-only update), SKUs, suppliers, and — when the
 * warehouse has no locations yet — the default RACK/FLOOR location layout.
 * Locations are NEVER deleted; this only creates the missing defaults so a
 * clean-DB seed works while preserving any user-edited location data.
 */
export async function seedMaster(db: DbClient): Promise<MasterIds> {
  const warehouse = await ensureWarehouses(db);

  for (const [code, plan] of Object.entries(LOCATION_PLAN)) {
    const whId = warehouse[code];
    if (!whId) continue;
    const existing = await db.storageLocation.count({ where: { warehouseId: whId } });
    if (existing > 0) continue; // locations already exist (user data) — keep them
    const rows = (
      ["RACK", "FLOOR"] as const
    ).flatMap((type) =>
      Array.from({ length: plan[type] }, (_, i) => ({
        warehouseId: whId,
        status: "ACTIVE" as const,
        id: `${code}/${type}/${String(i + 1).padStart(4, "0")}`,
      })),
    );
    if (rows.length > 0) {
      await db.storageLocation.createMany({ data: rows });
    }
  }

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
