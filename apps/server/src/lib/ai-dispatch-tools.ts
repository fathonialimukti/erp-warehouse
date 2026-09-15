/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
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
 *   - gather RAW pick candidate facts for a specific reserved pallet
 *
 * RAG-only: this file gathers raw operational facts and never scores, ranks,
 * or applies strategy. Decisions are made by the LLM using the retrieved
 * dispatch knowledge docs (knowledge_chunks sources `dispatch`,
 * `execution-analysis`) — see ai-warehouse-service.ts, the RAG-only service
 * that is the core for suggestions. The AI then drives the UI via client-side
 * tools (selectDispatchItem, highlightPickPallet) — it NEVER auto-persists
 * picks. The user confirms by clicking the highlighted pallet in the 3D view,
 * which calls dispatch.submitAssignment.
 *
 * Storage location ID convention: `WH01/<TYPE>/<NNNN>` (see ai-putaway-tools.ts).
 */

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

/** Outbound item table per dispatch type — resolves each reserved pallet to its outbound item (mirrors ai-warehouse-service.ts). */
const PICK_ITEM_MODELS: Record<string, { model: any; fkField: string }> = {
    WIP_ISSUE: { model: prisma.wipIssueItem, fkField: 'wipIssueId' },
    SHIPMENT: { model: prisma.shipmentItem, fkField: 'shipmentId' },
    RETURN_TO_SUPPLIER: { model: prisma.returnToSupplierItem, fkField: 'returnToSupplierId' },
    DISPOSAL: { model: prisma.disposalItem, fkField: 'disposalId' },
};

export const dispatchTools = {
    get_dispatch_state: tool({
        description:
            'Get the current dispatch (outbound pick) state for outbound transactions in a warehouse. ' +
            'Returns approved outbound transactions (shipment, wip-issue, return-to-supplier, disposal) ' +
            'that still have unpicked pallets, with each transaction\'s dispatch status (PENDING/PARTIAL) ' +
            'and the list of unpicked pallets (palletId, skuName, skuType, storageLocationId). ' +
            'If outboundTransactionId is provided, returns detail for that single transaction. ' +
            'Use this when the user asks "what needs picking?", "which shipments are pending?", ' +
            'or before gathering pick candidate facts for a specific outbound item.',
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
            '3D view), current storage location ID, and sequence number. ' +
            'Use this when the user asks "which pallets can I pick for this shipment?" or before gathering candidate facts.',
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
                pallets: lines.map((l) => ({
                    palletId: l.palletId,
                    skuId: l.pallet.skuId,
                    skuName: l.pallet.sku?.name ?? null,
                    skuType: l.pallet.sku?.type ?? null,
                    ...locationFacts(l.pallet.storageLocationId),
                })),
            };
        },
    }),

    get_pick_candidates: tool({
        description:
            'Get RAW pick candidate facts for a reserved pallet in an outbound transaction: the pallet\'s ' +
            'SKU + location facts, the reserved pallets grouped per outbound item (with storage locations), ' +
            'and same-SKU co-location facts. This tool does NOT recommend or score — the decision must ' +
            'follow the retrieved dispatch knowledge docs. ' +
            'Use after get_dispatch_state to gather the candidate facts before picking a pallet.',
        inputSchema: z.object({
            palletId: z.string().describe('The ULID of the reserved pallet to pick.'),
            outboundTransactionId: z.string().describe('The outbound transaction ULID.'),
        }),
        execute: async ({ palletId, outboundTransactionId }) => {
            const pallet = await prisma.pallet.findUnique({
                where: { id: palletId },
                select: {
                    id: true,
                    skuId: true,
                    storageLocationId: true,
                    status: true,
                    sku: { select: { name: true, type: true } },
                },
            });
            if (!pallet) {
                return { error: `Pallet ${palletId} not found.` };
            }
            if (pallet.status !== 'NOT_AVAILABLE') {
                return { error: `Pallet ${palletId} is not reserved for picking (status: ${pallet.status}).` };
            }

            // Reserved pallets for this transaction (PENDING pick lines) — raw facts, no scoring
            const lines = await prisma.pickLine.findMany({
                where: { documentId: outboundTransactionId, status: 'PENDING' },
                select: {
                    transactionType: true,
                    palletId: true,
                    pallet: {
                        select: {
                            skuId: true,
                            sourceItemId: true,
                            storageLocationId: true,
                            sku: { select: { name: true, type: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });

            // Resolve each reserved pallet to its outbound item (same derivation as ai-warehouse-service.ts)
            const itemBySku = new Map<string, string>();
            for (const [type, { model, fkField }] of Object.entries(PICK_ITEM_MODELS)) {
                const typeLines = lines.filter((l) => l.transactionType === type);
                if (typeLines.length === 0) continue;
                const rows = await model.findMany({
                    where: { [fkField]: outboundTransactionId },
                    select: { id: true, skuId: true },
                });
                for (const row of rows) itemBySku.set(row.skuId, row.id);
            }

            const reservedPalletsByItem = new Map<string, Array<Record<string, unknown>>>();
            for (const line of lines) {
                const itemId = line.pallet.sourceItemId ?? itemBySku.get(line.pallet.skuId) ?? null;
                const list = reservedPalletsByItem.get(itemId ?? line.palletId) ?? [];
                list.push({
                    palletId: line.palletId,
                    skuId: line.pallet.skuId,
                    skuName: line.pallet.sku?.name ?? null,
                    skuType: line.pallet.sku?.type ?? null,
                    ...locationFacts(line.pallet.storageLocationId),
                });
                reservedPalletsByItem.set(itemId ?? line.palletId, list);
            }

            // Same-SKU co-location facts: other stored pallets holding the same SKU
            const sameSkuPallets = pallet.skuId
                ? await prisma.pallet.findMany({
                      where: { skuId: pallet.skuId, id: { not: palletId }, storageLocationId: { not: null } },
                      select: { id: true, storageLocationId: true },
                  })
                : [];

            return {
                pallet: {
                    palletId: pallet.id,
                    skuId: pallet.skuId,
                    skuName: pallet.sku?.name ?? null,
                    skuType: pallet.sku?.type ?? null,
                    status: pallet.status,
                    ...locationFacts(pallet.storageLocationId),
                },
                reservedPalletsPerItem: [...reservedPalletsByItem.entries()].map(([outboundTransactionItemId, pallets]) => ({
                    outboundTransactionItemId,
                    pallets,
                })),
                sameSkuPallets: sameSkuPallets.map((p) => ({
                    palletId: p.id,
                    ...locationFacts(p.storageLocationId),
                })),
                note: 'Raw facts only — behavior follows the retrieved dispatch knowledge docs, no scoring.',
            };
        },
    }),
};