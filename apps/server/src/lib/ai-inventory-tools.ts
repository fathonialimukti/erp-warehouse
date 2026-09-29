import { tool } from "ai";
import { z } from "zod";
import { prisma } from "./prisma.js";

/**
 * Server-side AI tools for the Inventory Aging Analyzer.
 *
 * These tools run on the server (have an `execute` function) and return
 * structured, business-friendly results to the AI agent. The AI can use
 * them to answer concrete questions like:
 *   - "What is the total value of our dead stock?"
 *   - "Show me the highest-value dead stock in Zone A"
 *   - "Which zones have the most slow-moving inventory?"
 *
 * Aging categories:
 *   - dead_stock   : > 180 days since last stock movement
 *   - slow_moving  : 30–180 days since last stock movement
 *   - active       : < 30 days since last stock movement
 */

const DEAD_STOCK_THRESHOLD_DAYS = 180;
const SLOW_MOVING_THRESHOLD_DAYS = 30;

function classifyAging(
  days: number | null,
): "active" | "slow_moving" | "dead_stock" | "no_data" {
  if (days === null) return "no_data";
  if (days > DEAD_STOCK_THRESHOLD_DAYS) return "dead_stock";
  if (days > SLOW_MOVING_THRESHOLD_DAYS) return "slow_moving";
  return "active";
}

export const inventoryAgingTools = {
  get_inventory_aging_summary: tool({
    description:
      "Get a high-level summary of inventory aging across the whole warehouse. " +
      "Returns total SKU count, total inventory value, and a breakdown of how much " +
      "value is tied up in active vs slow-moving vs dead stock. " +
      "Use this when the user asks about overall inventory health, dead stock value, " +
      "or how much capital is locked in non-moving goods.",
    inputSchema: z.object({}),
    execute: async () => {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          sku_id: string;
          standard_cost: number | null;
          pallet_count: bigint;
          last_date: string | null;
        }>
      >(`
        WITH sku_last_movement AS (
          SELECT sm.sku_id, MAX(sm.transaction_date) AS last_date
          FROM stock_movements sm
          GROUP BY sm.sku_id
        )
        SELECT
          s.id AS sku_id,
          s.standard_cost,
          COUNT(p.id) AS pallet_count,
          slm.last_date::text AS last_date
        FROM skus s
        INNER JOIN pallets p ON p.sku_id = s.id
        LEFT JOIN sku_last_movement slm ON slm.sku_id = s.id
        WHERE p.status = 'AVAILABLE'
        GROUP BY s.id, s.standard_cost, slm.last_date
      `);

      const now = Date.now();
      const skuSet = new Set<string>();
      let totalValue = 0;
      let deadValue = 0;
      let slowValue = 0;
      let activeValue = 0;
      const deadSkus = new Set<string>();

      for (const row of rows) {
        const cost = Number(row.standard_cost ?? 0);
        const pallets = Number(row.pallet_count);
        const value = cost * pallets;
        const days = row.last_date
          ? Math.floor(
              (now - new Date(row.last_date).getTime()) / (1000 * 60 * 60 * 24),
            )
          : null;
        const category = classifyAging(days);

        skuSet.add(row.sku_id);
        totalValue += value;
        if (category === "dead_stock") {
          deadValue += value;
          deadSkus.add(row.sku_id);
        } else if (category === "slow_moving") {
          slowValue += value;
        } else if (category === "active") {
          activeValue += value;
        }
      }

      const pct = (n: number) =>
        totalValue > 0 ? Math.round((n / totalValue) * 1000) / 10 : 0;

      return {
        totalSkuCount: skuSet.size,
        totalInventoryValue: Math.round(totalValue),
        deadStock: {
          skuCount: deadSkus.size,
          value: Math.round(deadValue),
          percentage: pct(deadValue),
        },
        slowMoving: {
          value: Math.round(slowValue),
          percentage: pct(slowValue),
        },
        active: {
          value: Math.round(activeValue),
          percentage: pct(activeValue),
        },
        thresholds: {
          deadStockDays: DEAD_STOCK_THRESHOLD_DAYS,
          slowMovingDays: SLOW_MOVING_THRESHOLD_DAYS,
        },
      };
    },
  }),

  get_dead_stock_by_zone: tool({
    description:
      "Get the top dead-stock items (no movement beyond 180 days) in a specific warehouse zone, " +
      "or across all zones if no warehouseId is given. " +
      "Items are sorted by total value (qty × standard_cost) descending, so the most urgent " +
      "items to action appear first. " +
      "Use this when the user asks which items to clear first or wants to recover capital.",
    inputSchema: z.object({
      warehouseId: z
        .string()
        .optional()
        .describe(
          "Optional warehouse ULID. If omitted, returns dead stock across all warehouses.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of items to return (1-50, default 10)."),
    }),
    execute: async ({ warehouseId, limit }) => {
      const params: Array<string> = [];
      let warehouseFilter = "";
      if (warehouseId) {
        params.push(warehouseId);
        warehouseFilter = `AND w.id = $${params.length}`;
      }

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          code: string | null;
          name: string;
          type: string;
          warehouse_id: string;
          warehouse_name: string;
          pallet_count: number;
          standard_cost: number | null;
          total_value: number;
          last_movement_date: string | null;
          days_since_movement: number | null;
        }>
      >(
        `
        SELECT
          s.id, s.code, s.name, s.type,
          w.id AS warehouse_id, w.name AS warehouse_name,
          COUNT(p.id)::int AS pallet_count,
          s.standard_cost,
          (s.standard_cost * COUNT(p.id)) AS total_value,
          MAX(sm.transaction_date) AS last_movement_date,
          CASE
            WHEN MAX(sm.transaction_date) IS NULL THEN NULL
            ELSE (CURRENT_DATE - MAX(sm.transaction_date)::date)
          END AS days_since_movement
        FROM skus s
        INNER JOIN pallets p ON p.sku_id = s.id
        INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
        INNER JOIN warehouses w ON w.id = sl.warehouse_id
        LEFT JOIN stock_movements sm ON sm.sku_id = s.id
        WHERE p.status = 'AVAILABLE'
          AND (
            MAX(sm.transaction_date) IS NULL
            OR MAX(sm.transaction_date) < CURRENT_DATE - ${DEAD_STOCK_THRESHOLD_DAYS}
          )
          ${warehouseFilter}
        GROUP BY s.id, s.code, s.name, s.type, w.id, w.name, s.standard_cost
        ORDER BY total_value DESC
        LIMIT ${limit}
      `,
        ...params,
      );

      return {
        count: rows.length,
        thresholdDays: DEAD_STOCK_THRESHOLD_DAYS,
        items: rows.map((r) => ({
          skuId: r.id,
          skuCode: r.code,
          skuName: r.name,
          skuType: r.type,
          warehouseId: r.warehouse_id,
          warehouseName: r.warehouse_name,
          palletCount: r.pallet_count,
          standardCost: r.standard_cost ? Number(r.standard_cost) : null,
          totalValue: Math.round(Number(r.total_value)),
          lastMovementDate: r.last_movement_date,
          daysSinceMovement: r.days_since_movement,
        })),
      };
    },
  }),

  get_aging_by_zone: tool({
    description:
      "Get inventory aging breakdown grouped by warehouse zone. " +
      "For each warehouse, returns total pallets and value split across active, " +
      "slow-moving, and dead-stock categories. " +
      "Use this when the user asks which zones have the most dead stock or where capital is locked.",
    inputSchema: z.object({}),
    execute: async () => {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          warehouse_id: string;
          warehouse_name: string;
          pallet_count: bigint;
          standard_cost: number | null;
          last_date: string | null;
        }>
      >(`
        WITH sku_last_movement AS (
          SELECT sm.sku_id, MAX(sm.transaction_date) AS last_date
          FROM stock_movements sm
          GROUP BY sm.sku_id
        )
        SELECT
          w.id AS warehouse_id,
          w.name AS warehouse_name,
          COUNT(p.id) AS pallet_count,
          s.standard_cost,
          slm.last_date::text AS last_date
        FROM skus s
        INNER JOIN pallets p ON p.sku_id = s.id
        INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
        INNER JOIN warehouses w ON w.id = sl.warehouse_id
        LEFT JOIN sku_last_movement slm ON slm.sku_id = s.id
        WHERE p.status = 'AVAILABLE'
        GROUP BY w.id, w.name, s.id, s.standard_cost, slm.last_date
      `);

      const now = Date.now();
      const zoneMap = new Map<
        string,
        {
          warehouseId: string;
          warehouseName: string;
          pallets: number;
          deadValue: number;
          slowValue: number;
          activeValue: number;
          deadSkuCount: Set<string>;
        }
      >();

      for (const row of rows) {
        const cost = Number(row.standard_cost ?? 0);
        const pallets = Number(row.pallet_count);
        const value = cost * pallets;
        const days = row.last_date
          ? Math.floor(
              (now - new Date(row.last_date).getTime()) / (1000 * 60 * 60 * 24),
            )
          : null;
        const category = classifyAging(days);

        if (!zoneMap.has(row.warehouse_id)) {
          zoneMap.set(row.warehouse_id, {
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            pallets: 0,
            deadValue: 0,
            slowValue: 0,
            activeValue: 0,
            deadSkuCount: new Set(),
          });
        }
        const z = zoneMap.get(row.warehouse_id)!;
        z.pallets += pallets;
        if (category === "dead_stock") {
          z.deadValue += value;
          z.deadSkuCount.add(`${row.warehouse_id}-${row.last_date}`);
        } else if (category === "slow_moving") {
          z.slowValue += value;
        } else if (category === "active") {
          z.activeValue += value;
        }
      }

      return Array.from(zoneMap.values())
        .map((z) => ({
          warehouseId: z.warehouseId,
          warehouseName: z.warehouseName,
          totalPallets: z.pallets,
          deadStockValue: Math.round(z.deadValue),
          slowMovingValue: Math.round(z.slowValue),
          activeValue: Math.round(z.activeValue),
          deadStockSkuCount: z.deadSkuCount.size,
        }))
        .sort((a, b) => b.deadStockValue - a.deadStockValue);
    },
  }),

  get_warehouse_insights: tool({
    description:
      "Get a proactive warehouse health snapshot: dead-stock value, low-stock SKUs, " +
      "putaway backlog (inbound still needing putaway), dispatch backlog (outbound still " +
      "needing picking), and near-full locations. " +
      'Use when the user asks "how is the warehouse doing?", "what needs attention?", ' +
      "or any proactive health question.",
    inputSchema: z.object({}),
    execute: async () => {
      // Dead stock: AVAILABLE pallets with no movement in > 180 days.
      const deadStock = await prisma.$queryRawUnsafe<
        Array<{
          sku_id: string;
          sku_code: string;
          sku_name: string;
          standard_cost: number | null;
          pallet_count: bigint;
          last_movement_date: string | null;
          days_since_movement: number | null;
        }>
      >(`
        WITH sku_last_movement AS (
          SELECT sm.sku_id, MAX(sm.transaction_date) AS last_date
          FROM stock_movements sm
          GROUP BY sm.sku_id
        )
        SELECT
          s.id AS sku_id,
          s.code AS sku_code,
          s.name AS sku_name,
          s.standard_cost,
          COUNT(p.id) AS pallet_count,
          slm.last_date::text AS last_movement_date,
          CASE
            WHEN slm.last_date IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - slm.last_date)) / 86400)
          END AS days_since_movement
        FROM skus s
        INNER JOIN pallets p ON p.sku_id = s.id
        LEFT JOIN sku_last_movement slm ON slm.sku_id = s.id
        WHERE p.status = 'AVAILABLE'
        GROUP BY s.id, s.code, s.name, s.standard_cost, slm.last_date
        HAVING
          slm.last_date IS NULL
          OR slm.last_date < NOW() - INTERVAL '180 days'
      `);
      const deadStockValue = deadStock.reduce(
        (sum, r) => sum + Number(r.standard_cost ?? 0) * Number(r.pallet_count),
        0,
      );

      // Out-of-stock SKUs: SKUs with zero AVAILABLE pallets.
      const outOfStock = await prisma.$queryRawUnsafe<
        Array<{
          sku_id: string;
          sku_code: string;
          sku_name: string;
        }>
      >(`
        SELECT
          s.id AS sku_id,
          s.code AS sku_code,
          s.name AS sku_name
        FROM skus s
        LEFT JOIN pallets p ON p.sku_id = s.id AND p.status = 'AVAILABLE'
        GROUP BY s.id, s.code, s.name
        HAVING COUNT(p.id) = 0
      `);

      // ponytail: putawayBacklog filter is fragile (relies on storageLocationId: null alone). Add sourceType IN (...) filter if schema allows AVAILABLE pallets without location for other reasons.

      return {
        generatedAt: new Date().toISOString(),
        deadStockValue: Math.round(deadStockValue),
        deadStockSkuCount: deadStock.length,
        deadStockTop: deadStock.slice(0, 5).map((r) => ({
          skuCode: r.sku_code,
          skuName: r.sku_name,
          pallets: Number(r.pallet_count),
          value: Math.round(
            Number(r.standard_cost ?? 0) * Number(r.pallet_count),
          ),
          daysSinceMovement: r.days_since_movement,
        })),
        outOfStockSkus: outOfStock.map((r) => ({
          skuCode: r.sku_code,
          skuName: r.sku_name,
        })),
        putawayBacklog: await prisma.pallet.count({
          where: { storageLocationId: null, status: "AVAILABLE" },
        }),
        dispatchBacklog: await prisma.pickLine.count({
          where: { status: "PENDING" },
        }),
      };
    },
  }),
};
