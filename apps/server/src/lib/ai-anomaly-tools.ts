import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma.js';

/**
 * Server-side AI tools for anomaly detection.
 *
 * Deterministic rule engine — no LLM is needed to *detect* problems; the AI
 * narrates the results. Rules:
 *   - DEAD_STOCK (MEDIUM): AVAILABLE pallets with no stock movement > 180 days
 *   - OUT_OF_STOCK (HIGH): SKUs with zero AVAILABLE pallets
 *   - PUTAWAY_BACKLOG (MEDIUM): AVAILABLE pallets with no storage location
 *   - DISPATCH_BACKLOG (MEDIUM): pick lines still PENDING
 *   - NEAR_DUPLICATE_TRANSACTIONS (LOW): same warehouse + first-item sku +
 *     quantity within the last 24h
 */

const DEAD_STOCK_THRESHOLD_DAYS = 180;
const DEAD_STOCK_LIMIT = 5;
const OUT_OF_STOCK_LIMIT = 10;
const NEAR_DUPLICATE_LIMIT = 5;

type AnomalySeverity = 'HIGH' | 'MEDIUM' | 'LOW';

type Anomaly = {
    type: string;
    severity: AnomalySeverity;
    title: string;
    description: string;
    skuId?: string;
    skuCode?: string;
    transactionId?: string;
    createdAt: string;
};

export const anomalyTools = {
    get_anomalies: tool({
        description:
            'Detect warehouse problems deterministically: dead stock, out-of-stock SKUs, ' +
            'putaway backlog, dispatch backlog, and possible duplicate receiving transactions. ' +
            'Use when the user asks "what is wrong?", "what needs attention?", or wants a ' +
            'proactive health check. Returns anomalies sorted by severity.',
        inputSchema: z.object({}),
        execute: async () => {
            const generatedAt = new Date().toISOString();
            try {
                const anomalies: Anomaly[] = [];

                // DEAD_STOCK (MEDIUM): AVAILABLE pallets with no movement > 180 days, top 5 by value.
                const deadStock = await prisma.$queryRawUnsafe<Array<{
                    sku_id: string;
                    sku_code: string | null;
                    sku_name: string;
                    standard_cost: number | null;
                    pallet_count: bigint;
                    days_since_movement: number | null;
                }>>(`
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
          OR slm.last_date < NOW() - INTERVAL '${DEAD_STOCK_THRESHOLD_DAYS} days'
        ORDER BY (s.standard_cost * COUNT(p.id)) DESC
        LIMIT ${DEAD_STOCK_LIMIT}
      `);
                for (const r of deadStock) {
                    const pallets = Number(r.pallet_count);
                    const value = Math.round(Number(r.standard_cost ?? 0) * pallets);
                    const daysLabel =
                        r.days_since_movement === null
                            ? `over ${DEAD_STOCK_THRESHOLD_DAYS}`
                            : `${r.days_since_movement}`;
                    anomalies.push({
                        type: 'DEAD_STOCK',
                        severity: 'MEDIUM',
                        title: `Dead stock: ${r.sku_name}`,
                        description:
                            `${pallets} pallet(s) of ${r.sku_name} (${r.sku_code ?? 'no code'}) ` +
                            `have had no stock movement for ${daysLabel} days, worth ~$${value}.`,
                        createdAt: generatedAt,
                        ...(r.sku_id ? { skuId: r.sku_id } : {}),
                        ...(r.sku_code ? { skuCode: r.sku_code } : {}),
                    });
                }

                // OUT_OF_STOCK (HIGH): SKUs with zero AVAILABLE pallets, top 10.
                const outOfStock = await prisma.$queryRawUnsafe<Array<{
                    sku_id: string;
                    sku_code: string | null;
                    sku_name: string;
                }>>(`
        SELECT
          s.id AS sku_id,
          s.code AS sku_code,
          s.name AS sku_name
        FROM skus s
        LEFT JOIN pallets p ON p.sku_id = s.id AND p.status = 'AVAILABLE'
        GROUP BY s.id, s.code, s.name
        HAVING COUNT(p.id) = 0
        ORDER BY s.name ASC
        LIMIT ${OUT_OF_STOCK_LIMIT}
      `);
                for (const r of outOfStock) {
                    anomalies.push({
                        type: 'OUT_OF_STOCK',
                        severity: 'HIGH',
                        title: `Out of stock: ${r.sku_name}`,
                        description: `${r.sku_name} (${r.sku_code ?? 'no code'}) has zero available pallets.`,
                        createdAt: generatedAt,
                        ...(r.sku_id ? { skuId: r.sku_id } : {}),
                        ...(r.sku_code ? { skuCode: r.sku_code } : {}),
                    });
                }

                // PUTAWAY_BACKLOG (MEDIUM): AVAILABLE pallets with no storage location.
                const putawayBacklog = await prisma.pallet.count({
                    where: { storageLocationId: null, status: 'AVAILABLE' },
                });
                if (putawayBacklog > 0) {
                    anomalies.push({
                        type: 'PUTAWAY_BACKLOG',
                        severity: 'MEDIUM',
                        title: 'Putaway backlog',
                        description:
                            `${putawayBacklog} available pallet(s) are waiting to be put away ` +
                            `(no storage location assigned).`,
                        createdAt: generatedAt,
                    });
                }

                // DISPATCH_BACKLOG (MEDIUM): pick lines still PENDING.
                const dispatchBacklog = await prisma.pickLine.count({
                    where: { status: 'PENDING' },
                });
                if (dispatchBacklog > 0) {
                    anomalies.push({
                        type: 'DISPATCH_BACKLOG',
                        severity: 'MEDIUM',
                        title: 'Dispatch backlog',
                        description: `${dispatchBacklog} pick line(s) are still pending.`,
                        createdAt: generatedAt,
                    });
                }

                // NEAR_DUPLICATE_TRANSACTIONS (LOW): within 24h, receiving transactions
                // sharing warehouse + first-item sku + quantity. Cap at 5.
                const nearDuplicates = await prisma.$queryRawUnsafe<Array<{
                    warehouse_id: string;
                    sku_id: string;
                    quantity: string;
                    transaction_count: number;
                    transaction_ids: string[];
                }>>(`
        WITH first_items AS (
          SELECT DISTINCT ON (rti.receiving_transaction_id)
            rti.receiving_transaction_id,
            rti.sku_id,
            rti.quantity
          FROM receiving_transaction_items rti
          ORDER BY rti.receiving_transaction_id, rti.sort_order ASC NULLS LAST, rti.id ASC
        )
        SELECT
          rt.warehouse_id,
          fi.sku_id,
          fi.quantity::text AS quantity,
          COUNT(*)::int AS transaction_count,
          ARRAY_AGG(rt.id ORDER BY rt.created_at DESC) AS transaction_ids
        FROM receiving_transactions rt
        INNER JOIN first_items fi ON fi.receiving_transaction_id = rt.id
        WHERE rt.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY rt.warehouse_id, fi.sku_id, fi.quantity
        HAVING COUNT(*) >= 2
        ORDER BY transaction_count DESC
        LIMIT ${NEAR_DUPLICATE_LIMIT}
      `);
                for (const r of nearDuplicates) {
                    anomalies.push({
                        type: 'NEAR_DUPLICATE_TRANSACTIONS',
                        severity: 'LOW',
                        title: 'Possible duplicate receiving transactions',
                        description:
                            `${r.transaction_count} receiving transaction(s) in the last 24h share the same ` +
                            `warehouse, first item, and quantity (${r.quantity}) — possible duplicate entry.`,
                        createdAt: generatedAt,
                        ...(r.sku_id ? { skuId: r.sku_id } : {}),
                        ...(r.transaction_ids[0] ? { transactionId: r.transaction_ids[0] } : {}),
                    });
                }

                // Severity order: HIGH first, then MEDIUM, then LOW.
                const severityRank: Record<AnomalySeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                anomalies.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

                return { anomalies, generatedAt };
            } catch (error) {
                return {
                    anomalies: [],
                    generatedAt,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        },
    }),
};