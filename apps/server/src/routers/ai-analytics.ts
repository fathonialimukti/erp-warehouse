import { z } from 'zod';
import { generateText } from 'ai';
import { hasPermission, protectedProcedure, router } from '../trpc.js';
import { prisma } from '../lib/prisma.js';
import { chatModel } from '../lib/ai-provider.js';
import { validateReadOnlySql } from '../lib/ai-db-tools.js';

/**
 * AI Analytics — natural-language → chart.
 *
 * `suggestQuery` asks the LLM to translate a business question into read-only
 * SQL + a chart hint. `executeQuery` runs that SQL through the existing
 * `validateReadOnlySql` gate (SELECT/WITH/EXPLAIN only) and returns
 * JSON-serializable rows for the client to render as a chart or table.
 *
 * Both procedures degrade gracefully when the AI is unavailable — they never
 * throw to the client.
 */

const MAX_ROWS = 500;

const SCHEMA_HINT = `
Tables (PostgreSQL, snake_case):
- warehouses(id, name, code, address, total_capacity)
- storage_locations(id, warehouse_id, status)
- skus(id, code, name, base_unit, type, packages_per_pallet, quantity_per_package, standard_cost)
- pallets(id, sku_id, storage_location_id, status, source_type)
- suppliers(id, code, name)
- supplier_skus(supplier_id, sku_id, unit_price, lead_time_days, is_preferred)
- sku_inventory_balances(id, sku_id, warehouse_id, year, month, opening_qty, total_inbound, total_outbound, closing_qty)
- stock_movements(id, transaction_type, direction, document_id, sku_id, warehouse_id, quantity, signed_qty, transaction_date, posted_at)
- receiving_transactions(id, document_number, date, warehouse_id, supplier_id, approval_status)
- receiving_transaction_items(id, receiving_transaction_id, sku_id, quantity)
- shipments(id, document_number, date, warehouse_id, recipient, approval_status)
- shipment_items(id, shipment_id, sku_id, quantity)
- wip_completions, wip_completion_items, rma_receipts, rma_receipt_items, found_transactions, found_transaction_items, wip_issues, wip_issue_items, return_to_suppliers, return_to_supplier_items, disposals, disposal_items, subinventory_transfers, subinventory_transfer_items (same shared pattern: id, document_number, date, warehouse_id, approval_status + *_items(id, <parent>_id, sku_id, quantity))
`.trim();

const SQL_GENERATOR_PROMPT = (question: string) => `
You are a read-only SQL generator for a warehouse ERP (PostgreSQL).

${SCHEMA_HINT}

Rules:
- Return ONLY a JSON object, no markdown fences, no commentary: {"sql": "...", "chartType": "LINE"|"BAR"|"TABLE", "summary": "one-sentence plain-language summary of what the query answers"}
- sql must be SELECT-only (or WITH/EXPLAIN). No semicolons, no comments, no INSERT/UPDATE/DELETE/DROP/ALTER.
- Always add LIMIT ${MAX_ROWS}.
- chartType: LINE for time series, BAR for categorical comparisons, TABLE otherwise.
- summary: business language, no raw SQL.

User question: ${question}
`.trim();

const suggestQueryInputSchema = z.object({
    question: z.string().min(1, 'Question is required'),
});

const executeQueryInputSchema = z.object({
    sql: z.string().min(1, 'SQL is required'),
});

/** Format raw query rows into JSON-serializable values (Decimal → number, BigInt → string). */
function formatRowValue(value: unknown): unknown {
    if (value && typeof value === 'object' && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
        return (value as { toNumber: () => number }).toNumber();
    }
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'string' && value.length > 500) {
        return value.substring(0, 500) + '... [truncated]';
    }
    return value;
}

export const aiAnalyticsRouter = router({
    suggestQuery: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(suggestQueryInputSchema)
        .query(async ({ input }) => {
            try {
                const { text } = await generateText({
                    model: chatModel,
                    prompt: SQL_GENERATOR_PROMPT(input.question),
                    temperature: 0,
                });

                const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
                const parsed = JSON.parse(cleaned) as {
                    sql?: unknown;
                    chartType?: unknown;
                    summary?: unknown;
                };

                const sql = typeof parsed.sql === 'string' ? parsed.sql.trim() : null;
                const chartType =
                    parsed.chartType === 'LINE' || parsed.chartType === 'BAR' || parsed.chartType === 'TABLE'
                        ? parsed.chartType
                        : 'TABLE';
                const summary = typeof parsed.summary === 'string' ? parsed.summary : '';

                if (!sql) {
                    return { sql: null, chartType: 'TABLE' as const, table: [], summary: 'Could not parse' };
                }

                return { sql, chartType, table: [], summary };
            } catch {
                return { sql: null, chartType: 'TABLE' as const, table: [], summary: 'AI unavailable' };
            }
        }),

    executeQuery: protectedProcedure
        .use(hasPermission('stock-movement@read'))
        .input(executeQueryInputSchema)
        .query(async ({ input }) => {
            const validation = validateReadOnlySql(input.sql);
            if (!validation.valid) {
                return { error: `Query rejected: ${validation.reason ?? 'invalid SQL'}` };
            }

            try {
                const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
                    input.sql,
                );

                const limited = rows.slice(0, MAX_ROWS);
                const columns = limited.length > 0 ? Object.keys(limited[0] ?? {}) : [];
                const formatted = limited.map((row) => {
                    const out: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(row)) {
                        out[key] = formatRowValue(value);
                    }
                    return out;
                });

                return {
                    columns,
                    rows: formatted,
                    rowCount: formatted.length,
                    truncated: rows.length > MAX_ROWS,
                };
            } catch (error) {
                return {
                    error: error instanceof Error ? `Query failed: ${error.message}` : 'Query failed',
                };
            }
        }),
});