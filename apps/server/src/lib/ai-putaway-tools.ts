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
 *   - gather RAW putaway candidate facts for a specific pallet
 *
 * RAG-only: this file gathers raw operational facts and never scores, ranks,
 * or applies strategy. Decisions are made by the LLM using the retrieved
 * putaway knowledge docs (knowledge_chunks source `putaway`) — see
 * ai-warehouse-service.ts, the RAG-only service that is the core for
 * suggestions. The AI then drives the UI via client-side tools
 * (selectPutawayPallet, highlightPutawayLocation) — it NEVER auto-persists
 * assignments. The user confirms by clicking the highlighted location in the
 * 3D view.
 *
 * Storage location ID convention: `WH01/<TYPE>/<NNNN>`
 *   - TYPE is `FLOOR` or `RACK`
 *   - NNNN is a zero-padded sequence number
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

/** RAW location facts (id, placeholder, type, sequence) — data only, no scoring. */
const locationFacts = (locationId: string | null) => {
    const parsed = locationId ? parseLocationId(locationId) : null;
    return {
        storageLocationId: locationId,
        placeholderName: locationId ? locationIdToPlaceholderName(locationId) : null,
        type: parsed?.type ?? null,
        sequence: parsed?.seq ?? null,
    };
};

export const putawayTools = {
    get_putaway_state: tool({
        description:
            'Get the current putaway state for inbound transactions in a warehouse. ' +
            'Returns approved inbound (receiving) transactions that still have unassigned pallets, ' +
            'with each transaction\'s putaway status (PENDING/PARTIAL) and the list of unassigned pallets ' +
            '(palletId, skuName, skuType, palletTypeObjectId). ' +
            'If inboundTransactionId is provided, returns detail for that single transaction. ' +
            'Use this when the user asks "what needs putaway?", "which transactions have pending pallets?", ' +
            'or before gathering putaway candidate facts for a specific pallet.',
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
            'or when you need the full list of candidate locations before gathering candidate facts.',
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
                locations: locations.map((l) => locationFacts(l.id)),
            };
        },
    }),

    get_putaway_candidates: tool({
        description:
            'Get RAW putaway candidate facts for one unassigned pallet: the pallet\'s SKU name/type, ' +
            'the empty ACTIVE storage locations in the warehouse (id, placeholderName, type, sequence), ' +
            'and the locations already holding the same SKU. This tool does NOT recommend or score — ' +
            'the decision must follow the retrieved putaway knowledge docs. ' +
            'Use after get_putaway_state to gather the candidate facts for each pallet.',
        inputSchema: z.object({
            palletId: z.string().describe('The ULID of the unassigned pallet to place.'),
            warehouseId: z.string().describe('The warehouse ULID where the pallet should be placed.'),
        }),
        execute: async ({ palletId, warehouseId }) => {
            // Load the pallet + its SKU (raw facts only — no scoring)
            const pallet = await prisma.pallet.findUnique({
                where: { id: palletId },
                select: {
                    id: true,
                    skuId: true,
                    storageLocationId: true,
                    sku: { select: { name: true, type: true } },
                },
            });
            if (!pallet) {
                return { error: `Pallet ${palletId} not found.` };
            }
            if (pallet.storageLocationId) {
                return { error: `Pallet ${palletId} is already assigned to location ${pallet.storageLocationId}.` };
            }

            // Empty ACTIVE storage locations in the warehouse (candidate facts)
            const emptyLocations = await prisma.storageLocation.findMany({
                where: { warehouseId, status: 'ACTIVE', pallet: null },
                select: { id: true },
                orderBy: { id: 'asc' },
            });

            // Locations already holding the same SKU (raw consolidation fact)
            const sameSkuLocationIds = pallet.skuId
                ? (
                      await prisma.pallet.findMany({
                          where: { skuId: pallet.skuId, storageLocationId: { not: null } },
                          select: { storageLocationId: true },
                          distinct: ['storageLocationId'],
                      })
                  ).map((p) => p.storageLocationId)
                : [];

            return {
                pallet: {
                    palletId: pallet.id,
                    skuName: pallet.sku?.name ?? null,
                    skuType: pallet.sku?.type ?? null,
                },
                candidateLocations: emptyLocations.map((l) => locationFacts(l.id)),
                sameSkuLocations: sameSkuLocationIds.map((id) => locationFacts(id)),
                note: 'Raw facts only — behavior follows the retrieved putaway knowledge docs, no scoring.',
            };
        },
    }),
};