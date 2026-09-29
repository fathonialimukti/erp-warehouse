import type { DbClient } from "../../../lib/prisma.js";
import { ensureWarehouses } from "../catalog/warehouse.js";
import { allSkuRows } from "../catalog/skus.js";
import { SUPPLIERS, SKU_SUPPLIER } from "../catalog/partners.js";
import { PO_UNIT_PRICE, PURCHASE_ORDERS } from "../catalog/history.js";
import { SUPPLIER_LEAD_DAYS } from "../catalog/plans.js";

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
    const existing = await db.storageLocation.count({
      where: { warehouseId: whId },
    });
    if (existing > 0) continue; // locations already exist (user data) — keep them
    const rows = (["RACK", "FLOOR"] as const).flatMap((type) =>
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
      update: { name: s.name, objectId: s.objectId },
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

  await seedSupplierSkus(
    db,
    supplier,
    sku,
    Object.fromEntries(allSkuRows().map((s) => [s.code, s.packagesPerPallet])),
  );

  return { warehouse, sku, supplier };
}

/** Lead time for a finished-goods item from the contract assembler, in days. */
const ASSEMBLER_LEAD_DAYS = 9;

/**
 * Links every supplier to the items it actually supplies, so the
 * "open for receiving" supplier-item pickers and the reorder page's preferred
 * supplier have something to select.
 *
 * Two sources, unioned:
 *   - `SKU_SUPPLIER` — the nominated source per item, flagged `isPreferred` so
 *     the reorder page has a lead time, MOQ and price to show.
 *   - every `(supplierCode, skuCode)` pair that appears on a planned purchase
 *     order. A few orders are deliberately placed with an alternate source
 *     (Bright cartons, Flex driver units, HCMC solvent), and a supplier-item row
 *     that did not cover them would leave those PO lines with a supplier that
 *     does not list the item it is buying. Derived from the plan rather than
 *     listed, so it stays correct if the orders change.
 *
 * Idempotent: upserted on the composite primary key `(supplierId, skuId)`.
 */
async function seedSupplierSkus(
  db: DbClient,
  supplier: Record<string, string>,
  skuIds: Record<string, string>,
  packagesPerPallet: Record<string, number>,
): Promise<void> {
  const pairs = new Map<string, { preferred: boolean }>();

  for (const [skuCode, supplierCode] of Object.entries(SKU_SUPPLIER)) {
    if (!supplier[supplierCode]) continue;
    pairs.set(`${supplierCode}|${skuCode}`, { preferred: true });
  }
  for (const order of PURCHASE_ORDERS) {
    if (!supplier[order.supplierCode]) continue;
    for (const line of order.lines) {
      const key = `${order.supplierCode}|${line.skuCode}`;
      if (!pairs.has(key)) pairs.set(key, { preferred: false });
    }
  }

  for (const [key, { preferred }] of pairs) {
    const [supplierCode, skuCode] = key.split("|") as [string, string];
    const supplierId = supplier[supplierCode];
    const skuId = skuIds[skuCode];
    if (!supplierId || !skuId) continue;
    // One pallet in the SKU's own unit is the smallest sensible order, and the
    // price list the purchase orders already use.
    const data = {
      supplierItemCode: `${supplierCode.replace(/^SUP-/, "")}-${skuCode}`,
      unitPrice: PO_UNIT_PRICE[skuCode] ?? null,
      leadTimeDays: SUPPLIER_LEAD_DAYS[skuCode] ?? ASSEMBLER_LEAD_DAYS,
      minimumOrderQty: packagesPerPallet[skuCode] ?? null,
      isPreferred: preferred,
    };
    await db.supplierSku.upsert({
      where: { supplierId_skuId: { supplierId, skuId } },
      create: { supplierId, skuId, ...data },
      update: data,
    });
  }
}
