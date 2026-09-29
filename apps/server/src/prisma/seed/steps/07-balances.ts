import type { DbClient } from "../../../lib/prisma.js";
import { MONTHS_12 } from "../catalog/plans.js";

const toMonthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Computes monthly SkuInventoryBalance rows from the stock movements written by
 * the earlier steps. Invariant: closing = opening + totalInbound − totalOutbound
 * and closing is never negative. Idempotent via upsert on (sku, warehouse, year, month).
 *
 * `monthWindow` (default: the full 12) matches the seeded window — without it
 * a `SEED_MONTHS=3` seed wrote twelve balance rows per SKU/warehouse, nine of
 * them flat zeros.
 */
export async function runBalances(
  db: DbClient,
  monthWindow: number = MONTHS_12.length,
): Promise<void> {
  const months = MONTHS_12.slice(0, monthWindow);
  const movements = await db.stockMovement.findMany({
    select: {
      skuId: true,
      warehouseId: true,
      signedQty: true,
      transactionDate: true,
    },
    orderBy: { transactionDate: "asc" },
  });

  const byKey = new Map<
    string,
    {
      skuId: string;
      warehouseId: string;
      events: { date: Date; signedQty: number }[];
    }
  >();
  for (const m of movements) {
    const key = `${m.skuId}:${m.warehouseId}`;
    const entry = byKey.get(key) ?? {
      skuId: m.skuId,
      warehouseId: m.warehouseId,
      events: [],
    };
    entry.events.push({
      date: m.transactionDate,
      signedQty: Number(m.signedQty),
    });
    byKey.set(key, entry);
  }

  for (const { skuId, warehouseId, events } of byKey.values()) {
    let opening = 0;
    for (const monthKey of months) {
      const [yearStr, monthStr] = monthKey.split("-");
      if (!yearStr || !monthStr) continue;

      const monthEvents = events.filter((e) => toMonthKey(e.date) === monthKey);
      const totalInbound = monthEvents
        .filter((e) => e.signedQty > 0)
        .reduce((acc, cur) => acc + cur.signedQty, 0);
      const totalOutbound = monthEvents
        .filter((e) => e.signedQty < 0)
        .reduce((acc, cur) => acc + Math.abs(cur.signedQty), 0);
      const closing = opening + totalInbound - totalOutbound;

      if (closing < 0) {
        throw new Error(
          `balance invariant violated: ${skuId}@${warehouseId} ${monthKey} closing ${closing} < 0`,
        );
      }

      await db.skuInventoryBalance.upsert({
        where: {
          skuId_warehouseId_year_month: {
            skuId,
            warehouseId,
            year: Number(yearStr),
            month: Number(monthStr),
          },
        },
        update: {
          openingQty: Number(opening.toFixed(3)),
          totalInbound: Number(totalInbound.toFixed(3)),
          totalOutbound: Number(totalOutbound.toFixed(3)),
          closingQty: Number(closing.toFixed(3)),
        },
        create: {
          skuId,
          warehouseId,
          year: Number(yearStr),
          month: Number(monthStr),
          openingQty: Number(opening.toFixed(3)),
          totalInbound: Number(totalInbound.toFixed(3)),
          totalOutbound: Number(totalOutbound.toFixed(3)),
          closingQty: Number(closing.toFixed(3)),
        },
      });

      opening = closing;
    }
  }
}
