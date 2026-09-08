import { hasPermission, protectedProcedure, router } from '../trpc.js';
import {
    monthlyStockMovementInputSchema,
    skuAnnualSummaryInputSchema,
    skuMonthlyDetailInputSchema,
    skuStockListInputSchema,
    inventoryBalanceMonthlyInputSchema,
} from '@repo/schemas/report';
import { z } from 'zod';
import { Prisma } from '../prisma/generated/client.js';

const INBOUND_TYPES = ['RECEIVING', 'WIP_COMPLETION', 'RMA_RECEIPT', 'FOUND'] as const;
const OUTBOUND_TYPES = ['WIP_ISSUE', 'SHIPMENT', 'RETURN_TO_SUPPLIER', 'DISPOSAL', 'LOSS'] as const;

export const reportRouter = router({
    monthlyStockMovement: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(monthlyStockMovementInputSchema)
        .query(async ({ ctx, input }) => {
            const { year, month, warehouseId, skuId } = input;

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const baseWhere = {
                ...(warehouseId ? { warehouseId } : {}),
                ...(skuId ? { skuId } : {}),
            };

            const [priorBalances, currentMovements] = await Promise.all([
                ctx.db.stockMovement.groupBy({
                    by: ['skuId'],
                    where: { ...baseWhere, transactionDate: { lt: startDate } },
                    _sum: { signedQty: true },
                }),
                ctx.db.stockMovement.groupBy({
                    by: ['skuId', 'transactionType'],
                    where: { ...baseWhere, transactionDate: { gte: startDate, lte: endDate } },
                    _sum: { quantity: true, signedQty: true },
                }),
            ]);

            const skuIdSet = new Set<string>([
                ...priorBalances.map(r => r.skuId),
                ...currentMovements.map(r => r.skuId),
            ]);

            if (skuIdSet.size === 0) return { data: [], year, month };

            const skus = await ctx.db.sku.findMany({
                where: { id: { in: [...skuIdSet] } },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            });

            const priorMap = new Map(
                priorBalances.map(r => [r.skuId, Number(r._sum.signedQty ?? 0)]),
            );

            const movementMap = new Map<string, Record<string, number>>();
            const netSignedMap = new Map<string, number>();

            for (const row of currentMovements) {
                if (!movementMap.has(row.skuId)) movementMap.set(row.skuId, {});
                movementMap.get(row.skuId)![row.transactionType] = Number(row._sum.quantity ?? 0);
                netSignedMap.set(row.skuId, (netSignedMap.get(row.skuId) ?? 0) + Number(row._sum.signedQty ?? 0));
            }

            const data = skus.map(sku => {
                const openingQty = priorMap.get(sku.id) ?? 0;
                const netThisMonth = netSignedMap.get(sku.id) ?? 0;
                const closingQty = openingQty + netThisMonth;
                const m = movementMap.get(sku.id) ?? {};

                return {
                    sku,
                    openingQty,
                    inbound: {
                        RECEIVING: m['RECEIVING'] ?? 0,
                        WIP_COMPLETION: m['WIP_COMPLETION'] ?? 0,
                        RMA_RECEIPT: m['RMA_RECEIPT'] ?? 0,
                        FOUND: m['FOUND'] ?? 0,
                    },
                    transfer: {
                        SUBINVENTORY_TRANSFER: m['SUBINVENTORY_TRANSFER'] ?? 0,
                    },
                    outbound: {
                        WIP_ISSUE: m['WIP_ISSUE'] ?? 0,
                        SHIPMENT: m['SHIPMENT'] ?? 0,
                        RETURN_TO_SUPPLIER: m['RETURN_TO_SUPPLIER'] ?? 0,
                        DISPOSAL: m['DISPOSAL'] ?? 0,
                        LOSS: m['LOSS'] ?? 0,
                    },
                    closingQty,
                };
            });

            return { data, year, month };
        }),

    skuAnnualSummary: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(skuAnnualSummaryInputSchema)
        .query(async ({ ctx, input }) => {
            const { year, warehouseId } = input;
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year + 1, 0, 1);
            const baseWhere = warehouseId ? { warehouseId } : {};

            const [priorBalances, yearMovements] = await Promise.all([
                ctx.db.stockMovement.groupBy({
                    by: ['skuId'],
                    where: { ...baseWhere, transactionDate: { lt: yearStart } },
                    _sum: { signedQty: true },
                }),
                ctx.db.stockMovement.groupBy({
                    by: ['skuId', 'transactionType'],
                    where: { ...baseWhere, transactionDate: { gte: yearStart, lt: yearEnd } },
                    _sum: { quantity: true, signedQty: true },
                }),
            ]);

            const skuIdSet = new Set([
                ...priorBalances.map(r => r.skuId),
                ...yearMovements.map(r => r.skuId),
            ]);

            if (skuIdSet.size === 0) return { data: [], year };

            const skus = await ctx.db.sku.findMany({
                where: { id: { in: [...skuIdSet] } },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            });

            const priorMap = new Map(priorBalances.map(r => [r.skuId, Number(r._sum.signedQty ?? 0)]));
            const movementMap = new Map<string, Record<string, number>>();
            const netSignedMap = new Map<string, number>();

            for (const row of yearMovements) {
                if (!movementMap.has(row.skuId)) movementMap.set(row.skuId, {});
                movementMap.get(row.skuId)![row.transactionType] = Number(row._sum.quantity ?? 0);
                netSignedMap.set(row.skuId, (netSignedMap.get(row.skuId) ?? 0) + Number(row._sum.signedQty ?? 0));
            }

            const data = skus.map(sku => {
                const openingQty = priorMap.get(sku.id) ?? 0;
                const m = movementMap.get(sku.id) ?? {};
                const totalInbound = INBOUND_TYPES.reduce((s, t) => s + (m[t] ?? 0), 0);
                const totalOutbound = OUTBOUND_TYPES.reduce((s, t) => s + (m[t] ?? 0), 0);
                const closingQty = openingQty + (netSignedMap.get(sku.id) ?? 0);
                return { sku, openingQty, totalInbound, totalOutbound, closingQty };
            });

            return { data, year };
        }),

    skuMonthlyDetail: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(skuMonthlyDetailInputSchema)
        .query(async ({ ctx, input }) => {
            const { skuId, year, warehouseId } = input;
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year + 1, 0, 1);
            const baseWhere = { skuId, ...(warehouseId ? { warehouseId } : {}) };

            const [priorBalance, yearMovements, sku] = await Promise.all([
                ctx.db.stockMovement.aggregate({
                    where: { ...baseWhere, transactionDate: { lt: yearStart } },
                    _sum: { signedQty: true },
                }),
                ctx.db.stockMovement.findMany({
                    where: { ...baseWhere, transactionDate: { gte: yearStart, lt: yearEnd } },
                    select: { transactionDate: true, transactionType: true, quantity: true, signedQty: true },
                }),
                ctx.db.sku.findUnique({
                    where: { id: skuId },
                    select: { id: true, code: true, name: true },
                }),
            ]);

            const monthlyQty: Record<string, number>[] = Array.from({ length: 12 }, () => ({}));
            const monthlyNet: number[] = Array.from({ length: 12 }, () => 0);

            for (const row of yearMovements) {
                const mi = row.transactionDate.getMonth();
                const mq = monthlyQty[mi] as Record<string, number>;
                mq[row.transactionType] = (mq[row.transactionType] ?? 0) + Number(row.quantity);
                (monthlyNet as number[])[mi] = ((monthlyNet as number[])[mi] ?? 0) + Number(row.signedQty);
            }

            let balance = Number(priorBalance._sum.signedQty ?? 0);
            const months = Array.from({ length: 12 }, (_, i) => {
                const openingQty = balance;
                const mq = (monthlyQty[i] ?? {}) as Record<string, number>;
                const mn = (monthlyNet[i] ?? 0) as number;
                balance += mn;
                return {
                    month: i + 1,
                    openingQty,
                    inbound: {
                        RECEIVING: mq['RECEIVING'] ?? 0,
                        WIP_COMPLETION: mq['WIP_COMPLETION'] ?? 0,
                        RMA_RECEIPT: mq['RMA_RECEIPT'] ?? 0,
                        FOUND: mq['FOUND'] ?? 0,
                    },
                    transfer: { SUBINVENTORY_TRANSFER: mq['SUBINVENTORY_TRANSFER'] ?? 0 },
                    outbound: {
                        WIP_ISSUE: mq['WIP_ISSUE'] ?? 0,
                        SHIPMENT: mq['SHIPMENT'] ?? 0,
                        RETURN_TO_SUPPLIER: mq['RETURN_TO_SUPPLIER'] ?? 0,
                        DISPOSAL: mq['DISPOSAL'] ?? 0,
                        LOSS: mq['LOSS'] ?? 0,
                    },
                    closingQty: balance,
                };
            });

            return { sku, year, months };
        }),

    skuStockList: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(skuStockListInputSchema)
        .query(async ({ ctx, input }) => {
            const { warehouseId, search } = input;

            const movements = await ctx.db.stockMovement.groupBy({
                by: ['skuId'],
                where: warehouseId ? { warehouseId } : {},
                _sum: { signedQty: true },
            });

            if (movements.length === 0) return { data: [] };

            const stockMap = new Map(
                movements.map(m => [m.skuId, Number(m._sum.signedQty ?? 0)]),
            );

            const skus = await ctx.db.sku.findMany({
                where: {
                    id: { in: [...stockMap.keys()] },
                    ...(search
                        ? {
                              OR: [
                                  { name: { contains: search, mode: 'insensitive' } },
                                  { code: { contains: search, mode: 'insensitive' } },
                              ],
                          }
                        : {}),
                },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            });

            return {
                data: skus.map(sku => ({
                    sku,
                    currentStock: stockMap.get(sku.id) ?? 0,
                })),
            };
        }),

    inventoryBalanceMonthly: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(inventoryBalanceMonthlyInputSchema)
        .query(async ({ ctx, input }) => {
            const { year, warehouseId } = input;

            const where = {
                year,
                ...(warehouseId ? { warehouseId } : {}),
            };

            const balances = await ctx.db.skuInventoryBalance.findMany({
                where,
                orderBy: { month: 'asc' },
            });

            if (balances.length === 0) {
                return {
                    year,
                    months: Array.from({ length: 12 }, (_, i) => ({
                        month: i + 1,
                        openingQty: 0,
                        totalInbound: 0,
                        totalOutbound: 0,
                        closingQty: 0,
                    })),
                    totals: { openingQty: 0, totalInbound: 0, totalOutbound: 0, closingQty: 0 },
                };
            }

            const monthly: Record<number, { openingQty: number; totalInbound: number; totalOutbound: number; closingQty: number }> = {};
            for (let m = 1; m <= 12; m++) {
                monthly[m] = { openingQty: 0, totalInbound: 0, totalOutbound: 0, closingQty: 0 };
            }

            for (const b of balances) {
                const m = monthly[b.month]!;
                m.openingQty += Number(b.openingQty);
                m.totalInbound += Number(b.totalInbound);
                m.totalOutbound += Number(b.totalOutbound);
                m.closingQty += Number(b.closingQty);
            }

            const months = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                ...monthly[i + 1]!,
            }));

            const totals = {
                openingQty: months[0]?.openingQty ?? 0,
                totalInbound: months.reduce((s, m) => s + m.totalInbound, 0),
                totalOutbound: months.reduce((s, m) => s + m.totalOutbound, 0),
                closingQty: months[11]?.closingQty ?? 0,
            };

            return { year, months, totals };
        }),

    // -----------------------------------------------------------------------
    // Transaction Velocity — monthly inbound vs outbound stacked bars
    // -----------------------------------------------------------------------
    transactionVelocity: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(z.object({
            year: z.number().int().min(2020).max(2030),
            warehouseId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { year, warehouseId } = input;

            const rows = await ctx.db.$queryRawUnsafe<Array<{
                month: number;
                direction: string;
                total_qty: number;
            }>>(`
                SELECT
                    EXTRACT(MONTH FROM transaction_date)::int AS month,
                    direction::text,
                    SUM(quantity) AS total_qty
                FROM stock_movements
                WHERE EXTRACT(YEAR FROM transaction_date) = $1
                  ${warehouseId ? 'AND warehouse_id = $2' : ''}
                  AND direction IN ('IN', 'OUT')
                GROUP BY month, direction
                ORDER BY month, direction
            `, ...[year, ...(warehouseId ? [warehouseId] : [])]);

            // Build 12-month array
            const months = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                label: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }),
                inbound: 0,
                outbound: 0,
                net: 0,
            }));

            for (const row of rows) {
                const m = months[row.month - 1]!;
                if (row.direction === 'IN') m.inbound = Number(row.total_qty);
                else m.outbound = Number(row.total_qty);
                m.net = m.inbound - m.outbound;
            }

            const totals = months.reduce(
                (acc, m) => ({ inbound: acc.inbound + m.inbound, outbound: acc.outbound + m.outbound }),
                { inbound: 0, outbound: 0 },
            );

            return { year, months, totals };
        }),

    // -----------------------------------------------------------------------
    // ABC Pareto Analysis — SKU ranked by value descending + cumulative %
    // -----------------------------------------------------------------------
    abcAnalysis: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(z.object({
            warehouseId: z.string().optional(),
            type: z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING_MATERIAL']).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { warehouseId, type } = input;

            const params: Array<string | number> = [];
            const conditions: string[] = ['p.status = \'AVAILABLE\''];
            if (warehouseId) { conditions.push(`w.id = $${params.length + 1}`); params.push(warehouseId); }
            if (type) { conditions.push(`s.type = $${params.length + 1}::"SkuType"`); params.push(type); }

            const rows = await ctx.db.$queryRawUnsafe<Array<{
                sku_id: string;
                sku_code: string | null;
                sku_name: string;
                pallet_count: bigint;
                total_value: number;
            }>>(`
                SELECT
                    s.id AS sku_id,
                    s.code AS sku_code,
                    s.name AS sku_name,
                    COUNT(p.id) AS pallet_count,
                    COALESCE(s.standard_cost, 0) * COUNT(p.id) AS total_value
                FROM skus s
                INNER JOIN pallets p ON p.sku_id = s.id
                INNER JOIN storage_locations sl ON sl.id = p.storage_location_id
                INNER JOIN warehouses w ON w.id = sl.warehouse_id
                WHERE ${conditions.join(' AND ')}
                GROUP BY s.id, s.code, s.name, s.standard_cost
                HAVING COALESCE(s.standard_cost, 0) * COUNT(p.id) > 0
                ORDER BY total_value DESC
                LIMIT 200
            `, ...params);

            const grandTotal = rows.reduce((s, r) => s + Number(r.total_value), 0);

            let cumulative = 0;
            const items = rows.map((row, idx) => {
                const value = Number(row.total_value);
                cumulative += value;
                return {
                    rank: idx + 1,
                    skuId: row.sku_id,
                    skuCode: row.sku_code,
                    skuName: row.sku_name,
                    palletCount: Number(row.pallet_count),
                    value,
                    cumulativePercent: grandTotal > 0 ? Math.round((cumulative / grandTotal) * 1000) / 10 : 0,
                    abcClass: cumulative / grandTotal <= 0.8 ? 'A' : cumulative / grandTotal <= 0.95 ? 'B' : 'C' as const,
                };
            });

            return { grandTotal, itemCount: items.length, items };
        }),

    // -----------------------------------------------------------------------
    // Approval Cycle Time — average days from created to approved per type
    // -----------------------------------------------------------------------
    approvalCycle: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(z.object({
            year: z.number().int().min(2020).max(2030).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { year } = input;

            const yearFilter = year != null ? `EXTRACT(YEAR FROM t.created_at) = ${year}` : '1=1';

            const rows = await ctx.db.$queryRawUnsafe<Array<{
                transaction_type: string;
                avg_days: number | null;
                count: bigint;
            }>>(`
                SELECT 'RECEIVING' AS transaction_type,
                    AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400) AS avg_days,
                    COUNT(*) AS count
                FROM receiving_transactions t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'WIP_COMPLETION', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM wip_completions t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'RMA_RECEIPT', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM rma_receipts t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'FOUND', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM found_transactions t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'WIP_ISSUE', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM wip_issues t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'SHIPMENT', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM shipments t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'RETURN_TO_SUPPLIER', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM return_to_suppliers t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'DISPOSAL', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM disposals t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'LOSS', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM loss_transactions t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                UNION ALL
                SELECT 'SUBTX', AVG(EXTRACT(EPOCH FROM (t.approved_at - t.created_at)) / 86400), COUNT(*)
                FROM subinventory_transfers t WHERE t.approved_at IS NOT NULL AND ${yearFilter}
                ORDER BY avg_days DESC NULLS LAST
            `);

            return rows
                .map((r) => ({
                    transactionType: r.transaction_type,
                    avgDays: r.avg_days ? Math.round(Number(r.avg_days) * 10) / 10 : null,
                    count: Number(r.count),
                }))
                .filter((r) => r.count > 0);
        }),

    // -----------------------------------------------------------------------
    // Expiry report — pallets bucketed by remaining shelf life (FEFO aid)
    // -----------------------------------------------------------------------
    expiry: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(z.object({
            warehouseId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const warehouseFilter = input.warehouseId ? Prisma.sql`AND sl.warehouse_id = ${input.warehouseId}` : Prisma.empty;

            const pallets = await ctx.db.$queryRaw<Array<{
                id: string;
                pallet_number: string | null;
                lot_no: string | null;
                expiry_date: Date | null;
                sku_name: string;
                sku_code: string | null;
                warehouse_name: string;
                location_code: string | null;
            }>>(Prisma.sql`
                SELECT p.id, p.pallet_number, p.lot_no, p.expiry_date,
                       s.name AS sku_name, s.code AS sku_code,
                       w.name AS warehouse_name, sl.id AS location_code
                FROM pallets p
                JOIN skus s ON s.id = p.sku_id
                JOIN storage_locations sl ON sl.id = p.storage_location_id
                JOIN warehouses w ON w.id = sl.warehouse_id
                WHERE p.status = 'AVAILABLE' AND p.expiry_date IS NOT NULL ${warehouseFilter}
                ORDER BY p.expiry_date ASC
            `);

            const now = new Date();
            const dayMs = 24 * 60 * 60 * 1000;
            const items = pallets.map((p) => {
                const daysToExpiry = p.expiry_date ? Math.ceil((new Date(p.expiry_date).getTime() - now.getTime()) / dayMs) : null;
                const bucket =
                    daysToExpiry === null ? 'unknown'
                    : daysToExpiry < 0 ? 'expired'
                    : daysToExpiry <= 30 ? 'within_30'
                    : daysToExpiry <= 60 ? 'within_60'
                    : daysToExpiry <= 90 ? 'within_90'
                    : 'later';
                return {
                    id: p.id,
                    palletNumber: p.pallet_number,
                    lotNo: p.lot_no,
                    expiryDate: p.expiry_date ? new Date(p.expiry_date).toISOString() : null,
                    daysToExpiry,
                    bucket,
                    skuName: p.sku_name,
                    skuCode: p.sku_code,
                    warehouseName: p.warehouse_name,
                };
            });

            const summary = {
                expired: items.filter((i) => i.bucket === 'expired').length,
                within30: items.filter((i) => i.bucket === 'within_30').length,
                within60: items.filter((i) => i.bucket === 'within_60').length,
                within90: items.filter((i) => i.bucket === 'within_90').length,
            };

            return { items, summary };
        }),
});
