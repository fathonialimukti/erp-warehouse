import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { DISPATCH_TYPES } from './transaction.js';
import { parseLocationId, locationIdToPlaceholderName } from './ai-putaway-tools.js';

/**
 * Server-side AI tools for AI-assisted dispatch (outbound pick).
 *
 * These tools run on the server (have an `execute` function) and return
 * structured, business-friendly results to the AI agent. The AI uses them to:
 *   - inspect which outbound transactions still need picking
 *   - list reserved (NOT_AVAILABLE) pallets available to pick per outbound item
 *   - recommend the best pallet to pick for a specific outbound item
 *
 * The AI then drives the UI via client-side tools (selectDispatchItem,
 * highlightPickPallet) — it NEVER auto-persists picks. The user confirms by
 * clicking the highlighted pallet in the 3D view, which calls dispatch.submitAssignment.
 *
 * Pick strategy rules (mirror of putaway, reversed direction):
 *   1. Same-SKU grouping   — prefer pallets already co-located with the same SKU
 *   2. FIFO by age         — pick the oldest reserved pallet first (lower createdAt)
 *   3. Dock proximity      — prefer locations nearest the dispatch dock (lower sequence)
 *   4. Accessibility       — prefer floor-level locations (easier to reach with a forklift)
 *
 * Storage location ID convention: `WH01/<TYPE>/<NNNN>` (see ai-putaway-tools.ts).
 */

interface ScoredPallet {
    palletId: string;
    placeholderName: string | null;
    score: number;
    reasons: string[];
}

/**
 * Score a reserved pallet for a given outbound pick.
 * Higher score = better fit. Weights are tunable.
 */
function scorePallet(
    palletId: string,
    locationId: string | null,
    opts: {
        sameSku: boolean;
        maxSeq: number;
        ageRank: number; // 0..1, 1 = oldest
    },
): ScoredPallet | null {
    const parsed = locationId ? parseLocationId(locationId) : null;
    const placeholderName = locationId ? locationIdToPlaceholderName(locationId) : null;
    const reasons: string[] = [];
    let score = 0;

    // Rule 1: Same-SKU grouping (strongest signal — keep picks co-located)
    if (opts.sameSku) {
        score += 100;
        reasons.push('pallet co-located with the same SKU (consolidated pick)');
    }

    // Rule 2: FIFO by age — oldest reserved pallet first (0..30)
    score += Math.round(opts.ageRank * 30);
    reasons.push(`age rank ${Math.round(opts.ageRank * 100)}% (older reserved first)`);

    if (parsed) {
        // Rule 3: Dock proximity — lower sequence = nearer the dispatch dock (0..15)
        const proximityRank = opts.maxSeq > 0 ? 1 - parsed.seq / opts.maxSeq : 0;
        score += Math.round(proximityRank * 15);
        reasons.push(`sequence ${parsed.seq} (dock proximity rank ${Math.round(proximityRank * 100)}%)`);

        // Rule 4: Accessibility — floor locations get a small bonus
        if (parsed.type === 'FLOOR') {
            score += 15;
            reasons.push('floor-level location (easier forklift access)');
        }
    } else {
        reasons.push('no storage location (already reserved, location unknown)');
    }

    return { palletId, placeholderName, score, reasons };
}

export const dispatchTools = {
    get_dispatch_state: tool({
        description:
            'Get the current dispatch (outbound pick) state for outbound transactions in a warehouse. ' +
            'Returns approved outbound transactions (shipment, wip-issue, return-to-supplier, disposal) ' +
            'that still have unpicked pallets, with each transaction\'s dispatch status (PENDING/PARTIAL) ' +
            'and the list of unpicked pallets (palletId, skuName, skuType, storageLocationId). ' +
            'If outboundTransactionId is provided, returns detail for that single transaction. ' +
            'Use this when the user asks "what needs picking?", "which shipments are pending?", ' +
            'or before recommending a pallet to pick for a specific outbound item.',
        inputSchema: z.object({
            warehouseId: z
                .string()
                .optional()
                .describe('Optional warehouse ULID. If omitted, returns pending dispatch across all warehouses.'),
            outboundTransactionId: z
                .string()
                .optional()
                .describe('Optional specific outbound transaction ULID. If given, returns detail for that transaction only.'),
        }),
        execute: async ({ warehouseId, outboundTransactionId }) => {
            // ponytail: per-type loop queries each DISPATCH_MODEL separately. UNION query is faster at 1000+ approved outbound txns, but current approach is simpler.
            const DISPATCH_MODELS: Record<string, any> = {
                WIP_ISSUE: prisma.wipIssue,
                SHIPMENT: prisma.shipment,
                RETURN_TO_SUPPLIER: prisma.returnToSupplier,
                DISPOSAL: prisma.disposal,
            };
            const txns: Array<{ id: string; documentNumber: string | null; warehouseId: string; dispatchStatus: string; transactionType: string }> = [];
            for (const [type, model] of Object.entries(DISPATCH_MODELS)) {
                const rows = await model.findMany({
                    where: {
                        approvalStatus: 'APPROVED',
                        dispatchStatus: { in: ['PENDING', 'PARTIAL'] },
                        ...(warehouseId ? { warehouseId } : {}),
                        ...(outboundTransactionId ? { id: outboundTransactionId } : {}),
                    },
                    select: { id: true, documentNumber: true, warehouseId: true, dispatchStatus: true },
                    orderBy: { createdAt: 'asc' },
                    take: 50,
                });
                for (const r of rows) txns.push({ ...r, transactionType: type });
            }

            const txnIds = txns.map((t) => t.id);
            const lines = txnIds.length
                ? await prisma.pickLine.findMany({
                      where: { documentId: { in: txnIds }, status: 'PENDING' },
                      select: {
                          palletId: true,
                          documentId: true,
                          transactionType: true,
                          pallet: {
                              select: {
                                  sku: { select: { name: true, type: true, objectId: true } },
                                  storageLocationId: true,
                              },
                          },
                      },
                      orderBy: { createdAt: 'asc' },
                  })
                : [];

            const linesByTxn = new Map<string, typeof lines>();
            for (const line of lines) {
                const arr = linesByTxn.get(line.documentId) ?? [];
                arr.push(line);
                linesByTxn.set(line.documentId, arr);
            }

            return {
                count: txns.length,
                transactions: txns.map((t) => {
                    const unpicked = linesByTxn.get(t.id) ?? [];
                    return {
                        outboundTransactionId: t.id,
                        transactionType: t.transactionType,
                        documentNumber: t.documentNumber,
                        warehouseId: t.warehouseId,
                        dispatchStatus: t.dispatchStatus,
                        unpickedPalletCount: unpicked.length,
                        unpickedPallets: unpicked.map((l) => ({
                            palletId: l.palletId,
                            skuName: l.pallet.sku?.name ?? null,
                            skuType: l.pallet.sku?.type ?? null,
                            palletTypeObjectId: l.pallet.sku?.objectId ?? null,
                            storageLocationId: l.pallet.storageLocationId ?? null,
                        })),
                    };
                }),
            };
        },
    }),

    get_available_pick_pallets: tool({
        description:
            'Get the reserved (NOT_AVAILABLE) pallets available to pick for a specific outbound transaction, ' +
            'grouped by outbound item. Returns each pallet\'s ID, 3D placeholder name (for highlighting in the ' +
            '3D view), current storage location ID, and sequence number (for dock-proximity ordering). ' +
            'Use this when the user asks "which pallets can I pick for this shipment?" or before recommending one.',
        inputSchema: z.object({
            outboundTransactionId: z.string().describe('The outbound transaction ULID.'),
            transactionType: z.enum(DISPATCH_TYPES as [string, ...string[]]).describe('The outbound transaction type.'),
        }),
        execute: async ({ outboundTransactionId, transactionType }) => {
            if (!DISPATCH_TYPES.includes(transactionType as any)) {
                return { error: `Transaction type ${transactionType} does not support dispatch picking.` };
            }
            const lines = await prisma.pickLine.findMany({
                where: { documentId: outboundTransactionId, transactionType: transactionType as any, status: 'PENDING' },
                select: {
                    palletId: true,
                    pallet: {
                        select: {
                            skuId: true,
                            storageLocationId: true,
                            sku: { select: { name: true, type: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });

            return {
                count: lines.length,
                pallets: lines.map((l) => {
                    const parsed = l.pallet.storageLocationId ? parseLocationId(l.pallet.storageLocationId) : null;
                    return {
                        palletId: l.palletId,
                        skuId: l.pallet.skuId,
                        skuName: l.pallet.sku?.name ?? null,
                        skuType: l.pallet.sku?.type ?? null,
                        storageLocationId: l.pallet.storageLocationId ?? null,
                        placeholderName: l.pallet.storageLocationId ? locationIdToPlaceholderName(l.pallet.storageLocationId) : null,
                        sequence: parsed?.seq ?? null,
                    };
                }),
            };
        },
    }),

    recommend_pick_pallet: tool({
        description:
            'Recommend the best pallet to pick for a specific outbound item, applying the pick strategy rules: ' +
            'same-SKU grouping, FIFO by age, dock proximity, and floor accessibility. ' +
            'Returns the top recommended pallet (with 3D placeholder name for highlighting) plus 2-3 alternatives. ' +
            'After calling this, use the client tool `selectDispatchItem` to select the item in the panel, ' +
            'then `highlightPickPallet` to highlight the recommended pallet in the 3D view. ' +
            'The user confirms by clicking the highlighted pallet — you NEVER auto-persist the pick.',
        inputSchema: z.object({
            palletId: z.string().describe('The ULID of the reserved pallet to pick.'),
            outboundTransactionId: z.string().describe('The outbound transaction ULID.'),
        }),
        execute: async ({ palletId, outboundTransactionId }) => recommendPickForPallet(palletId, outboundTransactionId),
    }),
};

/**
 * Reusable: recommend the best pallet to pick for a single reserved pallet.
 * Returns the top recommendation + alternatives, or an error object on failure.
 */
export async function recommendPickForPallet(palletId: string, outboundTransactionId: string) {
    const pallet = await prisma.pallet.findUnique({
        where: { id: palletId },
        select: {
            id: true,
            skuId: true,
            storageLocationId: true,
            status: true,
            sku: { select: { id: true, name: true, type: true, objectId: true } },
        },
    });
    if (!pallet) {
        return { error: `Pallet ${palletId} not found.` };
    }
    if (pallet.status !== 'NOT_AVAILABLE') {
        return { error: `Pallet ${palletId} is not reserved for picking (status: ${pallet.status}).` };
    }

    // Load all PENDING pick lines for this transaction (the candidate pool)
    const lines = await prisma.pickLine.findMany({
        where: { documentId: outboundTransactionId, status: 'PENDING' },
        select: {
            palletId: true,
            pallet: { select: { skuId: true, storageLocationId: true } },
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    if (lines.length === 0) {
        return { error: 'No unpicked pallets available for this transaction.' };
    }

    // Find pallets already co-located with the same SKU (for same-SKU grouping rule)
    const sameSkuPalletIds = pallet.skuId
        ? (
              await prisma.pallet.findMany({
                  where: { skuId: pallet.skuId, storageLocationId: { not: null }, status: 'NOT_AVAILABLE' },
                  select: { id: true, storageLocationId: true },
              })
          ).map((p) => p.id)
        : [];
    const sameSkuSet = new Set(sameSkuPalletIds);

    const maxSeq = Math.max(
        ...lines.map((l) => (l.pallet.storageLocationId ? parseLocationId(l.pallet.storageLocationId)?.seq ?? 0 : 0)),
        1,
    );
    // Age rank: oldest createdAt = 1, newest = 0
    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];
    const oldest = firstLine?.createdAt ? new Date(firstLine.createdAt).getTime() : Date.now();
    const newest = lastLine?.createdAt ? new Date(lastLine.createdAt).getTime() : Date.now();
    const ageSpan = Math.max(newest - oldest, 1);

    const scored: ScoredPallet[] = lines
        .map((l) => {
            const createdAt = l.createdAt ? new Date(l.createdAt).getTime() : Date.now();
            const ageRank = (newest - createdAt) / ageSpan; // older → closer to 1
            return scorePallet(l.palletId, l.pallet.storageLocationId, {
                sameSku: sameSkuSet.has(l.palletId),
                maxSeq,
                ageRank,
            });
        })
        .filter((s): s is ScoredPallet => s !== null)
        .sort((a, b) => b.score - a.score);

    const top = scored.find((s) => s.palletId === palletId) ?? scored[0];
    const alternatives = scored.filter((s) => s.palletId !== top?.palletId).slice(0, 3);

    return {
        palletId: pallet.id,
        skuName: pallet.sku?.name ?? null,
        skuType: pallet.sku?.type ?? null,
        recommended: top
            ? {
                  palletId: top.palletId,
                  placeholderName: top.placeholderName,
                  score: top.score,
                  reason: top.reasons.join('; '),
              }
            : null,
        alternatives: alternatives.map((a) => ({
            palletId: a.palletId,
            placeholderName: a.placeholderName,
            score: a.score,
            reason: a.reasons.join('; '),
        })),
        strategyRules: [
            'same-SKU grouping (+100)',
            'FIFO by age (+0..30)',
            'dock proximity (+0..15)',
            'floor accessibility (+15)',
        ],
    };
}
