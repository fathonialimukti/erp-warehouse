import type { DbClient } from "../../../lib/prisma.js";
import { getOnHandPalletCounts } from "../../../lib/reorder.js";
import { allSkuRows } from "../catalog/skus.js";
import { SKU_SUPPLIER } from "../catalog/partners.js";
import type { MasterIds } from "./02-master.js";

/**
 * Reorder policies for the items each warehouse actually holds.
 *
 * `routers/reorder.ts` joins every policy with live on-hand pallet counts and
 * buckets them `below_min` / `below_reorder` / `ok`, so an empty
 * `sku_reorder_policies` table means the Reorder page opens on nothing and no
 * stock movement can ever raise a reorder alert (see
 * `lib/reorder.ts` `checkReorderThresholds`, which skips a pair with no policy).
 *
 * Thresholds are derived from the live on-hand count, so the page shows all
 * three buckets whatever the monthly plan happens to produce:
 *   - `below_min`     min above on-hand — the alert path, fire and forget
 *   - `below_reorder` min under on-hand, reorder point above it — the watch list
 *   - `ok`            min at half of on-hand, reorder point at on-hand
 *
 * Which bucket an item lands in is fixed by its position in the SKU catalog, not
 * by its stock level, so the spread stays stable across re-seeds.
 *
 * Idempotent: upserted on `(skuId, warehouseId)`, the model's unique key. A full
 * seed also clears them for free — `resetWarehouseDomain` deletes every SKU and
 * the policy's `sku` relation cascades.
 */
export async function runReorderPolicies(
  db: DbClient,
  ids: MasterIds,
): Promise<{ policies: number; belowMin: number; belowReorder: number }> {
  const onHand = await getOnHandPalletCounts(db);
  const onHandByKey = new Map(
    onHand.map((row) => [`${row.skuId}:${row.warehouseId}`, row.onHand]),
  );

  const rank = new Map(allSkuRows().map((s, index) => [s.code, index]));

  let policies = 0;
  let belowMin = 0;
  let belowReorder = 0;

  // Warehouse-major, so a walk through the seed log reads in that order too.
  for (const warehouseId of Object.values(ids.warehouse)) {
    for (const sku of allSkuRows()) {
      const skuId = ids.sku[sku.code];
      if (!skuId) continue;
      const stock = onHandByKey.get(`${skuId}:${warehouseId}`);
      // No policy for an item this warehouse has never held — a reorder policy
      // on a SKU you do not stock is a settings page nobody reads.
      if (stock === undefined) continue;

      const { minQty, maxQty, reorderPoint } = thresholdsFor(
        stock,
        rank.get(sku.code) ?? 0,
      );
      const supplierCode = SKU_SUPPLIER[sku.code];
      const preferredSupplierId = supplierCode
        ? ids.supplier[supplierCode]
        : undefined;

      await db.skuReorderPolicy.upsert({
        where: { skuId_warehouseId: { skuId, warehouseId } },
        create: {
          skuId,
          warehouseId,
          minQty,
          maxQty,
          reorderPoint,
          preferredSupplierId: preferredSupplierId ?? null,
        },
        update: {
          minQty,
          maxQty,
          reorderPoint,
          preferredSupplierId: preferredSupplierId ?? null,
        },
      });

      policies++;
      if (stock < minQty) belowMin++;
      else if (stock < reorderPoint) belowReorder++;
    }
  }

  return { policies, belowMin, belowReorder };
}

/** 1 in 5 items is short, 1 in 5 is on watch, the rest are healthy. */
const thresholdsFor = (onHand: number, rank: number) => {
  const bucket = rank % 5;
  if (bucket === 0) {
    // Below min: the reorder point the alert fires against.
    return {
      minQty: onHand + 4,
      reorderPoint: onHand + 9,
      maxQty: onHand + 18,
    };
  }
  if (bucket === 1) {
    // Below reorder: dipped under the min, not yet under the reorder point.
    return {
      minQty: Math.max(0, onHand - 2),
      reorderPoint: onHand + 3,
      maxQty: onHand + 12,
    };
  }
  return {
    minQty: Math.floor(onHand / 2),
    reorderPoint: onHand,
    maxQty: onHand + 12,
  };
};
