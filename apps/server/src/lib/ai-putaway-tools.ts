/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma.js';

/**
 * Server-side AI tools for AI-assisted putaway.
 *
 * These tools run on the server (have an `execute` function) and return
 * structured, business-friendly results to the AI agent. The AI uses them to:
 *   - inspect which inbound transactions still need putaway
 *   - list empty storage locations in a warehouse
 *   - recommend the best storage location for a specific pallet
 *
 * The AI then drives the UI via client-side tools (selectPutawayPallet,
 * highlightPutawayLocation) — it NEVER auto-persists assignments. The user
 * confirms by clicking the highlighted location in the 3D view.
 *
 * Putaway strategy rules (see knowledge/putaway.md):
 *   1. Same-SKU grouping   — prefer locations already holding the same SKU
 *   2. FIFO proximity      — fill locations nearest to the receiving area first
 *   3. Zone-based SKU type — raw / packaging / finished goods to designated zones
 *   4. Lower-floor priority — floor locations preferred for heavy/bulk pallets
 *
 * Storage location ID convention: `WH01/<TYPE>/<NNNN>`
 *   - TYPE is `FLOOR` or `RACK` (drives the lower-floor-priority rule)
 *   - NNNN is a zero-padded sequence number (drives the FIFO proximity rule)
 */

/** Parse a storage location ID `WH01/FLOOR/0001` into its components. */
export function parseLocationId(locationId: string): { type: string; seq: number } | null {
    const m = locationId.match(/^[^/]+\/([^/]+)\/(\d+)$/i);
    if (!m || !m[1] || !m[2]) return null;
    return { type: m[1].toUpperCase(), seq: parseInt(m[2], 10) };
}

/** Derive a 3D placeholder name from a storage location ID (mirrors the client helper). */
export function locationIdToPlaceholderName(locationId: string): string | null {
    const parsed = parseLocationId(locationId);
    if (!parsed) return null;
    const TYPE_TO_PREFIX: Record<string, string> = { RACK: 'pallet', FLOOR: 'floor' };
    const prefix = TYPE_TO_PREFIX[parsed.type] ?? parsed.type.toLowerCase();
    return `${prefix}_placeholder.${String(parsed.seq).padStart(3, '0')}`;
}

/** Map a SKU type to the storage location type that should hold it (zone rule). */
function preferredLocationTypeForSkuType(skuType: string): string | null {
    // Raw materials and packaging → floor (bulk); finished goods → rack (shelved).
    // This is a soft preference — the scorer awards a bonus, not a hard filter.
    switch (skuType) {
        case 'RAW_MATERIAL':
        case 'PACKAGING_MATERIAL':
            return 'FLOOR';
        case 'FINISHED_GOOD':
            return 'RACK';
        default:
            return null;
    }
}

interface ScoredLocation {
    storageLocationId: string;
    placeholderName: string | null;
    score: number;
    reasons: string[];
}

/**
 * Score an empty storage location for a given pallet.
 * Higher score = better fit. Weights are tunable.
 */
function scoreLocation(
    locationId: string,
    opts: {
        sameSku: boolean;
        skuType: string | null;
        maxSeq: number;
    },
): ScoredLocation | null {
    const parsed = parseLocationId(locationId);
    if (!parsed) return null;

    const placeholderName = locationIdToPlaceholderName(locationId);
    const reasons: string[] = [];
    let score = 0;

    // Rule 1: Same-SKU grouping (strongest signal — consolidate storage)
    if (opts.sameSku) {
        score += 100;
        reasons.push('location already holds the same SKU (consolidation)');
    }

    // Rule 2: FIFO proximity — lower sequence number = closer to receiving area
    // Normalise to 0..1 (lower seq → higher contribution) and scale to 30.
    const proximityRank = opts.maxSeq > 0 ? 1 - parsed.seq / opts.maxSeq : 0;
    score += Math.round(proximityRank * 30);
    reasons.push(`sequence ${parsed.seq} (proximity rank ${Math.round(proximityRank * 100)}%)`);

    // Rule 3: Zone-based SKU type — bonus if location type matches SKU preference
    const preferredType = opts.skuType ? preferredLocationTypeForSkuType(opts.skuType) : null;
    if (preferredType && parsed.type === preferredType) {
        score += 50;
        reasons.push(`${parsed.type} location matches ${opts.skuType} zone preference`);
    }

    // Rule 4: Lower-floor priority — floor locations get a small bonus
    if (parsed.type === 'FLOOR') {
        score += 15;
        reasons.push('floor-level location (easier access for heavy/bulk pallets)');
    }

    return { storageLocationId: locationId, placeholderName, score, reasons };
}

export const putawayTools = {
    get_putaway_state: tool({
        description:
            'Get the current putaway state for inbound transactions in a warehouse. ' +
            'Returns approved inbound (receiving) transactions that still have unassigned pallets, ' +
            'with each transaction\'s putaway status (PENDING/PARTIAL) and the list of unassigned pallets ' +
            '(palletId, skuName, skuType, palletTypeObjectId). ' +
            'If inboundTransactionId is provided, returns detail for that single transaction. ' +
            'Use this when the user asks "what needs putaway?", "which transactions have pending pallets?", ' +
            'or before recommending a putaway location for a specific pallet.',
        inputSchema: z.object({
            warehouseId: z
                .string()
                .optional()
                .describe('Optional warehouse ULID. If omitted, returns pending putaway across all warehouses.'),
            inboundTransactionId: z
                .string()
                .optional()
                .describe('Optional specific inbound transaction ULID. If given, returns detail for that transaction only.'),
        }),
        execute: async ({ warehouseId, inboundTransactionId }) => {
            // Fetch approved IN-direction transactions (all types that generate PutawayLines)
            // with PENDING/PARTIAL putaway status, across every putaway-capable model.
            const PUTAWAY_MODELS: Record<string, any> = {
                RECEIVING: prisma.receivingTransaction,
                WIP_COMPLETION: prisma.wipCompletion,
                RMA_RECEIPT: prisma.rmaReceipt,
                FOUND: prisma.foundTransaction,
            };
            const txns: Array<{ id: string; documentNumber: string | null; warehouseId: string; putawayStatus: string; transactionType: string }> = [];
            for (const [type, model] of Object.entries(PUTAWAY_MODELS)) {
                const rows = await model.findMany({
                    where: {
                        approvalStatus: 'APPROVED',
                        putawayStatus: { in: ['PENDING', 'PARTIAL'] },
                        ...(warehouseId ? { warehouseId } : {}),
                        ...(inboundTransactionId ? { id: inboundTransactionId } : {}),
                    },
                    select: { id: true, documentNumber: true, warehouseId: true, putawayStatus: true },
                    orderBy: { date: 'asc' },
                    take: 50,
                });
                for (const r of rows) txns.push({ ...r, transactionType: type });
            }

            // For each transaction, load its unassigned putaway lines (PENDING status)
            const txnIds = txns.map((t) => t.id);
            const lines = txnIds.length
                ? await prisma.putawayLine.findMany({
                      where: { documentId: { in: txnIds }, status: 'PENDING' },
                      select: {
                          palletId: true,
                          documentId: true,
                          transactionType: true,
                          pallet: { select: { sku: { select: { name: true, type: true, objectId: true } } } },
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
                    const unassigned = linesByTxn.get(t.id) ?? [];
                    return {
                        inboundTransactionId: t.id,
                        transactionType: t.transactionType,
                        documentNumber: t.documentNumber,
                        warehouseId: t.warehouseId,
                        putawayStatus: t.putawayStatus,
                        unassignedPalletCount: unassigned.length,
                        unassignedPallets: unassigned.map((l) => ({
                            palletId: l.palletId,
                            skuName: l.pallet.sku?.name ?? null,
                            skuType: l.pallet.sku?.type ?? null,
                            palletTypeObjectId: l.pallet.sku?.objectId ?? null,
                        })),
                    };
                }),
            };
        },
    }),

    get_available_storage_locations: tool({
        description:
            'Get all empty (unoccupied) storage locations in a warehouse that are available for putaway. ' +
            'Returns each location\'s ID, 3D placeholder name (for highlighting in the 3D view), ' +
            'type (FLOOR/RACK), and sequence number (for proximity ordering). ' +
            'Use this when the user asks "where can I put this pallet?" or "show me empty locations" ' +
            'or when you need the full list of candidate locations before recommending one.',
        inputSchema: z.object({
            warehouseId: z.string().describe('Warehouse ULID.'),
        }),
        execute: async ({ warehouseId }) => {
            // Empty = storage location with no pallet assigned + ACTIVE status
            const locations = await prisma.storageLocation.findMany({
                where: {
                    warehouseId,
                    status: 'ACTIVE',
                    pallet: null,
                },
                select: { id: true },
                orderBy: { id: 'asc' },
            });

            return {
                count: locations.length,
                locations: locations.map((l) => {
                    const parsed = parseLocationId(l.id);
                    return {
                        storageLocationId: l.id,
                        placeholderName: locationIdToPlaceholderName(l.id),
                        type: parsed?.type ?? null,
                        sequence: parsed?.seq ?? null,
                    };
                }),
            };
        },
    }),

    recommend_putaway_location: tool({
        description:
            'Recommend the best storage location for a specific unassigned pallet, applying the putaway strategy rules: ' +
            'same-SKU grouping, FIFO proximity, zone-based SKU type, and lower-floor priority. ' +
            'Returns the top recommended location (with 3D placeholder name for highlighting) plus 2-3 alternatives. ' +
            'After calling this, use the client tool `selectPutawayPallet` to select the pallet in the panel, ' +
            'then `highlightPutawayLocation` to highlight the recommended location in the 3D view. ' +
            'The user confirms by clicking the highlighted location — you NEVER auto-persist the assignment.',
        inputSchema: z.object({
            palletId: z.string().describe('The ULID of the unassigned pallet to place.'),
            warehouseId: z.string().describe('The warehouse ULID where the pallet should be placed.'),
        }),
        execute: async ({ palletId, warehouseId }) => recommendPutawayForPallet(palletId, warehouseId),
    }),
};

/**
 * Reusable: recommend the best storage location for a single unassigned pallet.
 * Returns the top recommendation + alternatives, or an error object on failure.
 */
export async function recommendPutawayForPallet(palletId: string, warehouseId: string) {
    // Load the pallet + its SKU (for same-SKU grouping and zone preference)
    const pallet = await prisma.pallet.findUnique({
        where: { id: palletId },
        select: {
            id: true,
            skuId: true,
            storageLocationId: true,
            sku: { select: { id: true, name: true, type: true, objectId: true } },
        },
    });
    if (!pallet) {
        return { error: `Pallet ${palletId} not found.` };
    }
    if (pallet.storageLocationId) {
        return { error: `Pallet ${palletId} is already assigned to location ${pallet.storageLocationId}.` };
    }

    // Load all empty ACTIVE storage locations in the warehouse
    const emptyLocations = await prisma.storageLocation.findMany({
        where: { warehouseId, status: 'ACTIVE', pallet: null },
        select: { id: true },
        orderBy: { id: 'asc' },
    });

    if (emptyLocations.length === 0) {
        return { error: 'No empty storage locations available in this warehouse.' };
    }

    // Find locations already holding the same SKU (for same-SKU grouping rule)
    const sameSkuLocationIds = pallet.skuId
        ? (
              await prisma.pallet.findMany({
                  where: { skuId: pallet.skuId, storageLocationId: { not: null } },
                  select: { storageLocationId: true },
                  distinct: ['storageLocationId'],
              })
          ).map((p) => p.storageLocationId)
        : [];

    const sameSkuSet = new Set(sameSkuLocationIds);
    const maxSeq = Math.max(
        ...emptyLocations.map((l) => parseLocationId(l.id)?.seq ?? 0),
        1,
    );

    // Score every empty location
    const scored: ScoredLocation[] = emptyLocations
        .map((l) =>
            scoreLocation(l.id, {
                sameSku: sameSkuSet.has(l.id),
                skuType: pallet.sku?.type ?? null,
                maxSeq,
            }),
        )
        .filter((s): s is ScoredLocation => s !== null)
        .sort((a, b) => b.score - a.score);

    const top = scored[0];
    const alternatives = scored.slice(1, 4);

    return {
        palletId: pallet.id,
        skuName: pallet.sku?.name ?? null,
        skuType: pallet.sku?.type ?? null,
        recommended: top
            ? {
                  storageLocationId: top.storageLocationId,
                  placeholderName: top.placeholderName,
                  score: top.score,
                  reason: top.reasons.join('; '),
              }
            : null,
        alternatives: alternatives.map((a) => ({
            storageLocationId: a.storageLocationId,
            placeholderName: a.placeholderName,
            score: a.score,
            reason: a.reasons.join('; '),
        })),
        strategyRules: [
            'same-SKU grouping (+100)',
            'FIFO proximity (+0..30)',
            'zone-based SKU type (+50)',
            'lower-floor priority (+15)',
        ],
    };
}

export interface PutawayProposal {
    palletId: string;
    skuName: string | null;
    skuType: string | null;
    storageLocationId: string;
    placeholderName: string | null;
    score: number;
    reason: string;
    alternatives: Array<{
        storageLocationId: string;
        placeholderName: string | null;
        score: number;
        reason: string;
    }>;
}

/**
 * Batch recommend putaway locations for ALL unassigned pallets in an inbound
 * (receiving) transaction. Used by the inline "AI Assist" button in the
 * PutawayPanel — proposals are returned for user review and approval, never
 * auto-persisted.
 *
 * Each pallet gets its own recommendation. To avoid two pallets being sent to
 * the same location, recommended locations are claimed greedily in pallet order
 * (oldest first) and removed from the candidate pool for subsequent pallets.
 */
export async function recommendBatchPutaway(
    inboundTransactionId: string,
    warehouseId: string,
    transactionType: string = 'RECEIVING',
): Promise<{ proposals: PutawayProposal[]; error?: string }> {
    // Load all PENDING putaway lines for this transaction (unassigned pallets)
    const lines = await prisma.putawayLine.findMany({
        where: { documentId: inboundTransactionId, transactionType: transactionType as any, status: 'PENDING' },
        select: {
            palletId: true,
            pallet: { select: { sku: { select: { name: true, type: true, objectId: true } } } },
        },
        orderBy: { createdAt: 'asc' },
    });

    if (lines.length === 0) {
        return { proposals: [], error: 'No unassigned pallets found for this transaction.' };
    }

    // Load all empty ACTIVE storage locations once (shared candidate pool)
    const emptyLocations = await prisma.storageLocation.findMany({
        where: { warehouseId, status: 'ACTIVE', pallet: null },
        select: { id: true },
        orderBy: { id: 'asc' },
    });

    if (emptyLocations.length === 0) {
        return { proposals: [], error: 'No empty storage locations available in this warehouse.' };
    }

    // Pre-compute per pallet's SKU (for grouping rule)
    // We need skuId for same-SKU grouping — fetch pallets with skuId
    const palletIds = lines.map((l) => l.palletId);
    const palletsWithSku = await prisma.pallet.findMany({
        where: { id: { in: palletIds } },
        select: { id: true, skuId: true },
    });
    const skuIdByPallet = new Map(palletsWithSku.map((p) => [p.id, p.skuId]));

    // For each distinct SKU in this batch, find locations already holding it
    const distinctSkuIds = new Set<string>();
    for (const l of lines) {
        const skuId = skuIdByPallet.get(l.palletId);
        if (skuId) distinctSkuIds.add(skuId);
    }
    const sameSkuLocationIdsBySku = new Map<string, Set<string>>();
    for (const skuId of distinctSkuIds) {
        const ids = (
            await prisma.pallet.findMany({
                where: { skuId, storageLocationId: { not: null } },
                select: { storageLocationId: true },
                distinct: ['storageLocationId'],
            })
        ).map((p) => p.storageLocationId).filter((id): id is string => id !== null);
        sameSkuLocationIdsBySku.set(skuId, new Set(ids));
    }

    const maxSeq = Math.max(
        ...emptyLocations.map((l) => parseLocationId(l.id)?.seq ?? 0),
        1,
    );

    // Greedy assignment: claim locations as we go so no two pallets get the same spot
    const claimedLocations = new Set<string>();
    const proposals: PutawayProposal[] = [];

    for (const line of lines) {
        const skuId = skuIdByPallet.get(line.palletId) ?? null;
        const sameSkuSet = skuId ? (sameSkuLocationIdsBySku.get(skuId) ?? new Set<string>()) : new Set<string>();
        const skuType = line.pallet.sku?.type ?? null;

        // Score all unclaimed empty locations
        const scored: ScoredLocation[] = emptyLocations
            .filter((l) => !claimedLocations.has(l.id))
            .map((l) =>
                scoreLocation(l.id, {
                    sameSku: sameSkuSet.has(l.id),
                    skuType,
                    maxSeq,
                }),
            )
            .filter((s): s is ScoredLocation => s !== null)
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
            // No locations left — skip this pallet (user will see it unassigned)
            continue;
        }

        const top = scored[0];
        if (!top) {
            // No locations left — skip this pallet (user will see it unassigned)
            continue;
        }
        const alternatives = scored.slice(1, 4);
        claimedLocations.add(top.storageLocationId);

        proposals.push({
            palletId: line.palletId,
            skuName: line.pallet.sku?.name ?? null,
            skuType,
            storageLocationId: top.storageLocationId,
            placeholderName: top.placeholderName,
            score: top.score,
            reason: top.reasons.join('; '),
            alternatives: alternatives.map((a) => ({
                storageLocationId: a.storageLocationId,
                placeholderName: a.placeholderName,
                score: a.score,
                reason: a.reasons.join('; '),
            })),
        });
    }

    return { proposals };
}
