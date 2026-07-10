import { z } from "zod";
import { hasPermission, protectedProcedure, router } from "../trpc.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Days since last movement before an item is considered "dead stock". */
const DEAD_STOCK_THRESHOLD_DAYS = 180;

/** Days since last movement before an item is considered "slow moving". */
const SLOW_MOVING_THRESHOLD_DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const agingFilterSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
  search: z.string().optional(),
  agingCategory: z.enum(["active", "slow_moving", "dead_stock", "no_data"]).optional(),
  warehouseId: z.string().optional(),
  type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "PACKAGING_MATERIAL"]).optional(),
  sortBy: z.enum(["value", "days_since_movement", "name"]).default("value").optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc").optional(),
});

const idSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Inventory Aging Analyzer — read-only analytics for identifying dead stock,
 * slow-moving inventory, and capital tied up in non-moving goods.
 *
 * @permission inventoryAging@read
 */
export function classifyAging(daysSinceLastMovement: number | null): "active" | "slow_moving" | "dead_stock" | "no_data" {
  if (daysSinceLastMovement === null) return "no_data";
  if (daysSinceLastMovement > DEAD_STOCK_THRESHOLD_DAYS) return "dead_stock";
  if (daysSinceLastMovement > SLOW_MOVING_THRESHOLD_DAYS) return "slow_moving";
  return "active";
}

export const inventoryAgingRouter = router({

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  /**
   * High-level summary: total SKU count, dead stock value, slow-moving
   * percentage, and category breakdowns.
   */
  summary: protectedProcedure.use(hasPermission("inventoryAging@read")).query(async ({ ctx }) => {
    // Get all pallets with their SKU info and last stock movement date.
    // We use a raw SQL query because the nesting is complex.
    const result = await ctx.db.$queryRawUnsafe<Array<{
      sku_id: string;
      sku_code: string | null;
      sku_name: string;
      sku_type: string;
      warehouse_id: string;
      warehouse_name: string;
      pallet_count: bigint;
      standard_cost: number | null;
      last_movement_date: string | null;
      pallet_created_at: string;
    }>>(`
      WITH sku_last_movement AS (
        SELECT
          sm.sku_id,
          MAX(sm.transaction_date) AS last_date
        FROM stock_movements sm
        GROUP BY sm.sku_id
      )
      SELECT
        s.id AS sku_id,
        s.code AS sku_code,
        s.name AS sku_name,
        s.type AS sku_type,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        COUNT(p.id) AS pallet_count,
        s.standard_cost,
        slm.last_date::text AS last_movement_date,
        MIN(p.created_at)::text AS pallet_created_at
      FROM skus s
      INNER JOIN pallets p ON p.sku_id = s.id
      INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
      INNER JOIN warehouses w ON w.id = sl.warehouse_id
      LEFT JOIN sku_last_movement slm ON slm.sku_id = s.id
      WHERE p.status = 'AVAILABLE'
      GROUP BY s.id, s.code, s.name, s.type, w.id, w.name, s.standard_cost, slm.last_date
    `);

    const now = new Date();
    let totalSkuSet = new Set<string>();
    let totalDeadStockValue = 0;
    let totalSlowMovingValue = 0;
    let totalActiveValue = 0;
    let totalNoDataValue = 0;
    let totalInventoryValue = 0;
    let deadStockSkuSet = new Set<string>();
    let slowMovingSkuSet = new Set<string>();
    let activeSkuSet = new Set<string>();

    // Zone-level aggregation
    const zoneMap = new Map<string, { name: string; deadValue: number; slowValue: number; activeValue: number; totalPallets: number }>();

    for (const row of result) {
      const cost = Number(row.standard_cost ?? 0);
      const palletCount = Number(row.pallet_count);
      const rowValue = cost * palletCount;
      const daysSinceMovement = row.last_movement_date
        ? Math.floor((now.getTime() - new Date(row.last_movement_date).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const category = classifyAging(daysSinceMovement);

      totalSkuSet.add(row.sku_id);
      totalInventoryValue += rowValue;

      if (category === "dead_stock") {
        totalDeadStockValue += rowValue;
        deadStockSkuSet.add(row.sku_id);
      } else if (category === "slow_moving") {
        totalSlowMovingValue += rowValue;
        slowMovingSkuSet.add(row.sku_id);
      } else if (category === "active") {
        totalActiveValue += rowValue;
        activeSkuSet.add(row.sku_id);
      } else {
        totalNoDataValue += rowValue;
      }

      // Zone aggregation
      const zoneId = row.warehouse_id;
      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, { name: row.warehouse_name, deadValue: 0, slowValue: 0, activeValue: 0, totalPallets: 0 });
      }
      const zone = zoneMap.get(zoneId)!;
      zone.totalPallets += palletCount;
      if (category === "dead_stock") zone.deadValue += rowValue;
      else if (category === "slow_moving") zone.slowValue += rowValue;
      else if (category === "active") zone.activeValue += rowValue;
    }

    return {
      totalSkuCount: totalSkuSet.size,
      totalInventoryValue,
      deadStockValue: totalDeadStockValue,
      deadStockSkuCount: deadStockSkuSet.size,
      deadStockPercentage: totalInventoryValue > 0 ? Math.round((totalDeadStockValue / totalInventoryValue) * 100 * 10) / 10 : 0,
      slowMovingValue: totalSlowMovingValue,
      slowMovingSkuCount: slowMovingSkuSet.size,
      slowMovingPercentage: totalInventoryValue > 0 ? Math.round((totalSlowMovingValue / totalInventoryValue) * 100 * 10) / 10 : 0,
      activeValue: totalActiveValue,
      activeSkuCount: activeSkuSet.size,
      activePercentage: totalInventoryValue > 0 ? Math.round((totalActiveValue / totalInventoryValue) * 100 * 10) / 10 : 0,
      noDataValue: totalNoDataValue,
      zoneBreakdown: Array.from(zoneMap.entries()).map(([id, z]) => ({
        warehouseId: id,
        warehouseName: z.name,
        deadValue: z.deadValue,
        slowValue: z.slowValue,
        activeValue: z.activeValue,
        totalPallets: z.totalPallets,
      })),
    };
  }),

  // -------------------------------------------------------------------------
  // Dead Stock List
  // -------------------------------------------------------------------------

  /**
   * Paginated list of dead-stock items sorted by value (highest first).
   */
  list: protectedProcedure.use(hasPermission("inventoryAging@read")).input(agingFilterSchema).query(async ({ ctx, input }) => {
    const { page = 1, limit = 20, search, agingCategory, warehouseId, type, sortBy, sortDir } = input;
    const { skip } = buildPaginationParams({ page, limit });

    // Build WHERE clause segments
    const conditions: string[] = ["p.status = 'AVAILABLE'"];
    const params: Array<string | number> = [];

    if (search) {
      conditions.push("(s.name ILIKE $" + (params.length + 1) + " OR s.code ILIKE $" + (params.length + 1) + ")");
      params.push(`%${search}%`);
    }
    if (warehouseId) {
      conditions.push("w.id = $" + (params.length + 1));
      params.push(warehouseId);
    }
    if (type) {
      conditions.push("s.type = $" + (params.length + 1) + "::\"SkuType\"");
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Build HAVING clause for aging category filter
    let havingClause = "";
    if (agingCategory) {
      if (agingCategory === "dead_stock") {
        havingClause = `HAVING COALESCE(MAX(sm.transaction_date), '1970-01-01'::date) < CURRENT_DATE - ${DEAD_STOCK_THRESHOLD_DAYS}`;
      } else if (agingCategory === "slow_moving") {
        havingClause = `HAVING COALESCE(MAX(sm.transaction_date), '1970-01-01'::date) >= CURRENT_DATE - ${DEAD_STOCK_THRESHOLD_DAYS} AND COALESCE(MAX(sm.transaction_date), '1970-01-01'::date) < CURRENT_DATE - ${SLOW_MOVING_THRESHOLD_DAYS}`;
      } else if (agingCategory === "active") {
        havingClause = `HAVING COALESCE(MAX(sm.transaction_date), '1970-01-01'::date) >= CURRENT_DATE - ${SLOW_MOVING_THRESHOLD_DAYS}`;
      } else if (agingCategory === "no_data") {
        havingClause = "HAVING MAX(sm.transaction_date) IS NULL";
      }
    }

    // Sort direction
    const orderMap: Record<string, string> = {
      value: `"total_value" ${sortDir === "asc" ? "ASC" : "DESC"}`,
      days_since_movement: `"days_since_movement" ${sortDir === "asc" ? "ASC" : "DESC"}`,
      name: `s.name ${sortDir === "asc" ? "ASC" : "DESC"}`,
    };
    const orderBy = orderMap[sortBy ?? "value"] ?? orderMap.value;

    // Count query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT s.id
        FROM skus s
        INNER JOIN pallets p ON p.sku_id = s.id
        INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
        INNER JOIN warehouses w ON w.id = sl.warehouse_id
        LEFT JOIN stock_movements sm ON sm.sku_id = s.id
        ${whereClause}
        GROUP BY s.id
        ${havingClause}
      ) sub
    `;

    const [countResult] = await ctx.db.$queryRawUnsafe<Array<{ total: number }>>(countSql, ...params);
    const total = countResult?.total ?? 0;

    // Data query
    const dataSql = `
      SELECT
        s.id,
        s.code,
        s.name,
        s.type,
        s.standard_cost,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        COUNT(p.id)::int AS pallet_count,
        (s.standard_cost * COUNT(p.id)) AS total_value,
        COALESCE(MAX(sm.transaction_date), NULL) AS last_movement_date,
        CASE
          WHEN MAX(sm.transaction_date) IS NULL THEN NULL
          ELSE (CURRENT_DATE - MAX(sm.transaction_date)::date)
        END AS days_since_movement
      FROM skus s
      INNER JOIN pallets p ON p.sku_id = s.id
      INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
      INNER JOIN warehouses w ON w.id = sl.warehouse_id
      LEFT JOIN stock_movements sm ON sm.sku_id = s.id
      ${whereClause}
      GROUP BY s.id, s.code, s.name, s.type, s.standard_cost, w.id, w.name
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${skip}
    `;

    const rows = await ctx.db.$queryRawUnsafe<Array<{
      id: string;
      code: string | null;
      name: string;
      type: string;
      standard_cost: number | null;
      warehouse_id: string;
      warehouse_name: string;
      pallet_count: number;
      total_value: number | null;
      last_movement_date: string | null;
      days_since_movement: number | null;
    }>>(dataSql, ...params);

    const data = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      standardCost: row.standard_cost ? Number(row.standard_cost) : null,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      palletCount: Number(row.pallet_count),
      totalValue: row.total_value ? Number(row.total_value) : 0,
      lastMovementDate: row.last_movement_date,
      daysSinceMovement: row.days_since_movement ? Number(row.days_since_movement) : null,
      agingCategory: classifyAging(row.days_since_movement ? Number(row.days_since_movement) : null),
    }));

    return {
      data,
      meta: buildPaginationMeta({ page, limit, total }),
    };
  }),

  // -------------------------------------------------------------------------
  // By Supplier
  // -------------------------------------------------------------------------

  /**
   * Aging summary filtered to SKUs linked to a specific supplier via SupplierSku.
   * Returns per-SKU aging in the same format as `list`.
   */
  bySupplier: protectedProcedure
    .use(hasPermission("inventoryAging@read"))
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.$queryRawUnsafe<Array<{
        sku_id: string;
        sku_code: string | null;
        sku_name: string;
        sku_type: string;
        pallet_count: bigint;
        standard_cost: number | null;
        total_value: number | null;
        last_movement_date: string | null;
        days_since_movement: number | null;
      }>>(`
        SELECT
          s.id AS sku_id,
          s.code AS sku_code,
          s.name AS sku_name,
          s.type AS sku_type,
          COUNT(p.id) AS pallet_count,
          s.standard_cost,
          (s.standard_cost * COUNT(p.id)) AS total_value,
          MAX(sm.transaction_date) AS last_movement_date,
          CASE
            WHEN MAX(sm.transaction_date) IS NULL THEN NULL
            ELSE (CURRENT_DATE - MAX(sm.transaction_date)::date)
          END AS days_since_movement
        FROM skus s
        INNER JOIN supplier_skus ss ON ss.sku_id = s.id
        INNER JOIN pallets p ON p.sku_id = s.id
        LEFT JOIN stock_movements sm ON sm.sku_id = s.id
        WHERE ss.supplier_id = $1
          AND p.status = 'AVAILABLE'
        GROUP BY s.id, s.code, s.name, s.type, s.standard_cost
        ORDER BY total_value DESC
      `, input.supplierId);

      const data = rows.map((row) => ({
        skuId: row.sku_id,
        skuCode: row.sku_code,
        skuName: row.sku_name,
        skuType: row.sku_type,
        palletCount: Number(row.pallet_count),
        standardCost: row.standard_cost ? Number(row.standard_cost) : null,
        totalValue: row.total_value ? Number(row.total_value) : 0,
        lastMovementDate: row.last_movement_date,
        daysSinceMovement: row.days_since_movement ? Number(row.days_since_movement) : null,
        agingCategory: classifyAging(row.days_since_movement ? Number(row.days_since_movement) : null),
      }));

      // Compute summary
      let deadValue = 0, slowValue = 0, activeValue = 0, deadCount = 0;
      for (const item of data) {
        if (item.agingCategory === "dead_stock") { deadValue += item.totalValue; deadCount++; }
        else if (item.agingCategory === "slow_moving") slowValue += item.totalValue;
        else if (item.agingCategory === "active") activeValue += item.totalValue;
      }

      return {
        skuCount: data.length,
        deadStockValue: deadValue,
        deadStockSkuCount: deadCount,
        slowMovingValue: slowValue,
        activeValue,
        items: data,
      };
    }),

  // -------------------------------------------------------------------------
  // By Product (SKU)
  // -------------------------------------------------------------------------

  /**
   * Aging detail for a single finished-good product SKU.
   * Shows aggregated pallet-level aging.
   */
  byProduct: protectedProcedure
    .use(hasPermission("inventoryAging@read"))
    .input(z.object({ skuId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.$queryRawUnsafe<Array<{
        pallet_id: string;
        pallet_status: string;
        warehouse_id: string;
        warehouse_name: string;
        storage_location_id: string | null;
        pallet_created: string;
        last_movement_date: string | null;
        days_since_movement: number | null;
      }>>(`
        SELECT
          p.id AS pallet_id,
          p.status AS pallet_status,
          w.id AS warehouse_id,
          w.name AS warehouse_name,
          sl.id AS storage_location_id,
          p.created_at::text AS pallet_created,
          MAX(sm.transaction_date) AS last_movement_date,
          CASE
            WHEN MAX(sm.transaction_date) IS NULL THEN NULL
            ELSE (CURRENT_DATE - MAX(sm.transaction_date)::date)
          END AS days_since_movement
        FROM pallets p
        INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
        INNER JOIN warehouses w ON w.id = sl.warehouse_id
        LEFT JOIN stock_movements sm ON sm.sku_id = $1 AND sm.warehouse_id = w.id
        WHERE p.sku_id = $1
          AND p.status = 'AVAILABLE'
        GROUP BY p.id, p.status, w.id, w.name, sl.id, p.created_at
        ORDER BY p.created_at ASC
      `, input.skuId);

      if (rows.length === 0) {
        return { totalPallets: 0, deadStockPallets: 0, slowMovingPallets: 0, activePallets: 0, items: [] };
      }

      let dead = 0, slow = 0, active = 0;
      const items = rows.map((row) => {
        const cat = classifyAging(row.days_since_movement);
        if (cat === "dead_stock") dead++;
        else if (cat === "slow_moving") slow++;
        else if (cat === "active") active++;
        return {
          palletId: row.pallet_id,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          palletCreated: row.pallet_created,
          lastMovementDate: row.last_movement_date,
          daysSinceMovement: row.days_since_movement ? Number(row.days_since_movement) : null,
          agingCategory: cat,
        };
      });

      return {
        totalPallets: rows.length,
        deadStockPallets: dead,
        slowMovingPallets: slow,
        activePallets: active,
        items,
      };
    }),
});