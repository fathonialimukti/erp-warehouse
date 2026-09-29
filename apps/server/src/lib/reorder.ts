import { Prisma } from "../prisma/generated/client";
import { type DbClient } from "./prisma.js";
import { notify } from "./notification-service.js";

/**
 * Reorder-point engine.
 *
 * On-hand is computed live from AVAILABLE pallets grouped per SKU + warehouse
 * (matching the pallet-granular reservation logic used by dispatch).
 */

export interface ReorderThresholdContext {
  skuId: string;
  warehouseId: string;
}

/** Live on-hand pallet counts for one warehouse (or all when warehouseId is null). */
export const getOnHandPalletCounts = async (
  db: DbClient,
  warehouseId?: string,
) => {
  const warehouseFilter = warehouseId
    ? Prisma.sql`AND sl.warehouse_id = ${warehouseId}`
    : Prisma.empty;
  const rows = await db.$queryRaw<
    Array<{ sku_id: string; warehouse_id: string; on_hand: bigint }>
  >(
    Prisma.sql`
            SELECT p.sku_id, sl.warehouse_id, COUNT(*)::bigint AS on_hand
            FROM pallets p
            JOIN storage_locations sl ON sl.id = p.storage_location_id
            WHERE p.status = 'AVAILABLE'
            ${warehouseFilter}
            GROUP BY p.sku_id, sl.warehouse_id
        `,
  );
  return rows.map((row) => ({
    skuId: row.sku_id,
    warehouseId: row.warehouse_id,
    onHand: Number(row.on_hand),
  }));
};

/** Fire reorder notifications for (sku, warehouse) pairs that dropped below their reorder point. Rate-limited to one alert per pair per 24h. */
export const checkReorderThresholds = async (
  db: DbClient,
  pairs: ReorderThresholdContext[],
): Promise<void> => {
  if (pairs.length === 0) return;

  const uniquePairs = pairs.filter(
    (pair, index, all) =>
      all.findIndex(
        (p) => p.skuId === pair.skuId && p.warehouseId === pair.warehouseId,
      ) === index,
  );

  for (const pair of uniquePairs) {
    try {
      const policy = await db.skuReorderPolicy.findUnique({
        where: {
          skuId_warehouseId: {
            skuId: pair.skuId,
            warehouseId: pair.warehouseId,
          },
        },
        include: {
          sku: { select: { code: true, name: true } },
          warehouse: { select: { name: true, code: true } },
          preferredSupplier: { select: { name: true } },
        },
      });
      if (!policy || policy.reorderPoint.toNumber() <= 0) continue;

      const onHand = await db.pallet.count({
        where: {
          skuId: pair.skuId,
          status: "AVAILABLE",
          storageLocation: { warehouseId: pair.warehouseId },
        },
      });
      if (onHand >= policy.reorderPoint.toNumber()) continue;

      // Rate limit: skip if a REORDER alert for this pair fired in the last 24h.
      const recentAlert = await db.notification.findFirst({
        where: {
          targetType: "REORDER",
          targetId: `${pair.skuId}:${pair.warehouseId}`,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentAlert) continue;

      const recipients = await db.user.findMany({
        where: {
          role: {
            permissions: { some: { permission: { name: "reorder@read" } } },
          },
        },
        select: { id: true },
      });
      if (recipients.length === 0) continue;

      const suggestedQty = Math.max(policy.maxQty.toNumber() - onHand, 0);
      await notify(db, {
        users: recipients.map((u) => u.id),
        title: "Reorder point reached",
        message: `${policy.sku.name}${policy.sku.code ? ` (${policy.sku.code})` : ""} at ${policy.warehouse.name} is down to ${onHand} pallet(s) — reorder point is ${policy.reorderPoint}. Suggested order: ${suggestedQty} pallet(s)${policy.preferredSupplier ? ` from ${policy.preferredSupplier.name}` : ""}.`,
        link: "/reorder",
        type: "WARNING",
        targetType: "REORDER",
        targetId: `${pair.skuId}:${pair.warehouseId}`,
      });
    } catch (error) {
      // Best-effort: reorder alerts must never break stock movement writes.
      console.warn("checkReorderThresholds failed", error);
    }
  }
};
