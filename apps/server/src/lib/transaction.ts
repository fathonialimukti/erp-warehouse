import { TRPCError } from "@trpc/server";
import { getMessage, type ServerLocale } from "./locale.js";
import type { DbClient } from "./prisma.js";
import { getNextPalletNumber } from "./pallet-number.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import type { WarehouseTransactionType, MovementDirection } from "../prisma/generated/client.js";

export interface TransactionItemIdentity {
    skuId: string;
}

/**
 * Direction of every warehouse transaction type.
 * IN  → produces PutawayLines (pallets placed into storage on approval)
 * OUT → produces PickLines (pallets reserved + taken out of storage on approval)
 * NONE → internal/adjustment types with their own line tables (no putaway/dispatch)
 *
 * This is the single source of truth for the unified `transaction` router's
 * putaway (IN) vs dispatch (OUT) routing — replacing the old inbound/outbound split.
 */
export const DIRECTION_BY_TYPE: Record<WarehouseTransactionType, MovementDirection> = {
    RECEIVING: "IN",
    WIP_COMPLETION: "IN",
    RMA_RECEIPT: "IN",
    FOUND: "IN",
    WIP_ISSUE: "OUT",
    SHIPMENT: "OUT",
    RETURN_TO_SUPPLIER: "OUT",
    DISPOSAL: "OUT",
    SUBINVENTORY_TRANSFER: "NONE",
    LOSS: "NONE",
};

export type TransactionDirection = MovementDirection; // 'IN' | 'OUT' | 'NONE'

/** IN-direction types that generate PutawayLines on approval. */
export const PUTAWAY_TYPES = Object.entries(DIRECTION_BY_TYPE)
    .filter(([, dir]) => dir === "IN")
    .map(([type]) => type) as WarehouseTransactionType[];

/** OUT-direction types that generate PickLines on approval. */
export const DISPATCH_TYPES = Object.entries(DIRECTION_BY_TYPE)
    .filter(([, dir]) => dir === "OUT")
    .map(([type]) => type) as WarehouseTransactionType[];

/** Resolve the parent document for any transaction type, returning a unified shape. */
export interface ResolvedTransactionDocument {
    id: string;
    warehouseId: string;
    approvalStatus: string;
    reference: string | null;
    documentNumber: string | null;
    dispatchStatus?: string;
    putawayStatus?: string;
    items: Array<{ id: string; skuId: string; quantity: number }>;
}

/** Convert a Prisma item row's Decimal quantity to number for the unified shape. */
const toResolvedItems = (items: Array<{ id: string; skuId: string; quantity: { toNumber(): number } | number }>) =>
    items.map((it) => ({
        id: it.id,
        skuId: it.skuId,
        quantity: typeof it.quantity === "number" ? it.quantity : it.quantity.toNumber(),
    }));

export const resolveTransactionDocument = async (
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
): Promise<ResolvedTransactionDocument | null> => {
    const baseSelect = {
        id: true,
        warehouseId: true,
        approvalStatus: true,
        reference: true,
        documentNumber: true,
        items: { select: { id: true, skuId: true, quantity: true } },
    } as const;

    switch (transactionType) {
        case "RECEIVING": {
            const d = await db.receivingTransaction.findUnique({ where: { id: documentId }, select: { ...baseSelect, putawayStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, putawayStatus: d.putawayStatus } : null;
        }
        case "WIP_COMPLETION": {
            const d = await db.wipCompletion.findUnique({ where: { id: documentId }, select: { ...baseSelect, putawayStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, putawayStatus: d.putawayStatus } : null;
        }
        case "RMA_RECEIPT": {
            const d = await db.rmaReceipt.findUnique({ where: { id: documentId }, select: { ...baseSelect, putawayStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, putawayStatus: d.putawayStatus } : null;
        }
        case "FOUND": {
            const d = await db.foundTransaction.findUnique({ where: { id: documentId }, select: { ...baseSelect, putawayStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, putawayStatus: d.putawayStatus } : null;
        }
        case "WIP_ISSUE": {
            const d = await db.wipIssue.findUnique({ where: { id: documentId }, select: { ...baseSelect, dispatchStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, dispatchStatus: d.dispatchStatus } : null;
        }
        case "SHIPMENT": {
            const d = await db.shipment.findUnique({ where: { id: documentId }, select: { ...baseSelect, dispatchStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, dispatchStatus: d.dispatchStatus } : null;
        }
        case "RETURN_TO_SUPPLIER": {
            const d = await db.returnToSupplier.findUnique({ where: { id: documentId }, select: { ...baseSelect, dispatchStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, dispatchStatus: d.dispatchStatus } : null;
        }
        case "DISPOSAL": {
            const d = await db.disposal.findUnique({ where: { id: documentId }, select: { ...baseSelect, dispatchStatus: true } });
            return d ? { ...d, items: toResolvedItems(d.items), reference: d.reference ?? d.documentNumber ?? null, dispatchStatus: d.dispatchStatus } : null;
        }
        default:
            return null;
    }
};

export const availableTransactionPalletStatuses = ["AVAILABLE"] as const;

export type ApprovalHistoryEntry = {
    process: string;
    userName: string;
    timeframe: string;
    message: string;
};

export type ApprovalStatus = (typeof approvalStatusValues)[number];

export const normalizeText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

export const ensureNoDuplicateTransactionItems = (
    items: TransactionItemIdentity[],
    locale: ServerLocale,
    duplicateItemMessageKey: string,
) => {
    const keys = new Set<string>();
    for (const item of items) {
        if (keys.has(item.skuId)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, duplicateItemMessageKey),
            });
        }
        keys.add(item.skuId);
    }
};

export const ensureTransactionSkusExist = async (
    db: DbClient,
    items: TransactionItemIdentity[],
    locale: ServerLocale,
    messageKey: string,
) => {
    const skuIds = items.map((item) => item.skuId);
    const skuRows = await db.sku.findMany({
        where: { id: { in: skuIds } },
        select: { id: true },
    });

    const existingSkuIds = new Set(skuRows.map((row) => row.id));

    for (const item of items) {
        if (!existingSkuIds.has(item.skuId)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, messageKey, {
                    skuId: item.skuId,
                }),
            });
        }
    }
};



export const ensureDraftOnly = (
    approvalStatus: ApprovalStatus | null | undefined,
    message: string,
) => {
    if (approvalStatus !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureDraftOrRejected = (
    approvalStatus: ApprovalStatus | null | undefined,
    message: string,
) => {
    if (approvalStatus !== "DRAFT" && approvalStatus !== "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureActionableApprovalStatus = (
    approvalStatus: ApprovalStatus | null | undefined,
    message: string,
) => {
    if (approvalStatus !== "PROPOSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const buildApprovalActionData = (
    approvalHistory: unknown,
    user: { userId: string; name?: string | null; email?: string | null },
    approvalStatus: ApprovalStatus,
    message?: string,
) => {
    const existingHistory = Array.isArray(approvalHistory) ? approvalHistory : [];
    const userName = user.name ?? user.email ?? "Unknown user";
    const nextAction: ApprovalHistoryEntry = {
        process: approvalStatus,
        userName,
        timeframe: new Date().toISOString(),
        message: message ?? "",
    };

    const result: {
        approvalStatus: ApprovalStatus;
        approvedById?: string;
        approvedAt?: Date;
        approvalHistory: ApprovalHistoryEntry[];
    } = {
        approvalStatus,
        approvalHistory: [...existingHistory, nextAction],
    };

    if (approvalStatus === "APPROVED" || approvalStatus === "REJECTED") {
        result.approvedById = user.userId;
        result.approvedAt = new Date();
    }

    return result;
};

export const buildTransactionBaseWhere = (input?: {
    approvalStatus?: ApprovalStatus | ApprovalStatus[];
    dateFrom?: Date;
    dateTo?: Date;
}): Record<string, unknown> => ({
    ...(input?.approvalStatus
        ? Array.isArray(input.approvalStatus)
            ? { approvalStatus: { in: input.approvalStatus } }
            : { approvalStatus: input.approvalStatus }
        : {}),
    ...(input?.dateFrom || input?.dateTo
        ? {
              date: {
                  ...(input?.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input?.dateTo ? { lte: input.dateTo } : {}),
              },
          }
        : {}),
});

export const summarizeItemTransaction = <
    T extends { items: Array<{ quantity: { toNumber(): number } | number }> },
>(
    row: T,
) => ({
    ...row,
    totalItems: row.items.length,
    totalQuantity: row.items.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber();
        return sum + qty;
    }, 0),
});

// ===========================================================
// STOCK MOVEMENT HELPERS
// ===========================================================

export interface StockMovementItem {
    skuId: string;
    quantity: { toNumber(): number } | number;
}

/**
 * Write StockMovement records + upsert SkuInventoryBalance.
 * Call once per transaction on APPROVED. Never call again.
 */
export const writeStockMovements = async (
    db: DbClient,
    params: {
        transactionType: WarehouseTransactionType;
        direction: MovementDirection;
        documentId: string;
        documentNumber: string | null;
        warehouseId: string;
        transactionDate: Date;
        postedById: string;
        items: StockMovementItem[];
    },
) => {
    const sign = params.direction === 'IN' ? 1 : params.direction === 'OUT' ? -1 : 0;

    await db.stockMovement.createMany({
        data: params.items.map((item) => {
            const qty = typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber();
            return {
                transactionType: params.transactionType,
                direction: params.direction,
                documentId: params.documentId,
                documentNumber: params.documentNumber,
                skuId: item.skuId,
                warehouseId: params.warehouseId,
                quantity: qty,
                signedQty: qty * sign,
                transactionDate: params.transactionDate,
                postedById: params.postedById,
            };
        }),
    });

    const year = params.transactionDate.getFullYear();
    const month = params.transactionDate.getMonth() + 1;

    for (const item of params.items) {
        const qty = typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber();
        await db.skuInventoryBalance.upsert({
            where: { skuId_warehouseId_year_month: { skuId: item.skuId, warehouseId: params.warehouseId, year, month } },
            create: {
                skuId: item.skuId,
                warehouseId: params.warehouseId,
                year,
                month,
                openingQty: 0,
                totalInbound: params.direction === 'IN' ? qty : 0,
                totalOutbound: params.direction === 'OUT' ? qty : 0,
                closingQty: params.direction === 'IN' ? qty : params.direction === 'OUT' ? -qty : 0,
            },
            update: {
                ...(params.direction === 'IN' ? {
                    totalInbound: { increment: qty },
                    closingQty: { increment: qty },
                } : params.direction === 'OUT' ? {
                    totalOutbound: { increment: qty },
                    closingQty: { decrement: qty },
                } : {}),
            },
        });
    }
};

// ===========================================================
// PUTAWAY HELPERS (IN transactions)
// ===========================================================

export interface PutawayItem {
    itemId: string;
    skuId: string;
    /** Number of pallets to create — should equal transaction item quantity */
    quantity: { toNumber(): number } | number;
}

/**
 * Create Pallet records (with polymorphic source) + PutawayLine records.
 * Call once per IN transaction on APPROVED.
 */
export const createPalletsAndPutawayLines = async (
    db: DbClient,
    params: {
        transactionType: WarehouseTransactionType;
        documentId: string;
        items: PutawayItem[];
    },
) => {
    const now = new Date();

    for (const item of params.items) {
        const count = Math.round(
            typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber(),
        );
        if (count <= 0) continue;

        // Create pallets sequentially so each gets a deterministic next
        // palletNumber (parallel creation would race the daily counter).
        const pallets: Array<{ id: string }> = [];
        for (let i = 0; i < count; i++) {
            const palletNumber = await getNextPalletNumber(db, now);
            const pallet = await db.pallet.create({
                data: {
                    palletNumber,
                    skuId: item.skuId,
                    sourceType: params.transactionType,
                    sourceItemId: item.itemId,
                    status: 'AVAILABLE',
                },
                select: { id: true },
            });
            pallets.push(pallet);
        }

        await db.putawayLine.createMany({
            data: pallets.map((pallet) => ({
                transactionType: params.transactionType,
                documentId: params.documentId,
                palletId: pallet.id,
            })),
        });
    }
};

/**
 * Read-only computation of a document's putaway status from its PutawayLine rows.
 * Returns 'PENDING' | 'PARTIAL' | 'COMPLETED' based on completed/total ratio.
 * Does NOT mutate the parent document (unlike syncPutawayStatus in the putaway router).
 */
export const computePutawayStatus = async (
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
): Promise<'PENDING' | 'PARTIAL' | 'COMPLETED'> => {
    const [total, completed] = await Promise.all([
        db.putawayLine.count({ where: { documentId, transactionType } }),
        db.putawayLine.count({ where: { documentId, transactionType, status: 'COMPLETED' } }),
    ]);
    if (total === 0) return 'PENDING';
    if (completed === 0) return 'PENDING';
    if (completed === total) return 'COMPLETED';
    return 'PARTIAL';
};

// ===========================================================
// DISPATCH (PICK) HELPERS (OUT transactions)
// ===========================================================

export interface DispatchItem {
    skuId: string;
    /** Number of pallets to reserve */
    quantity: { toNumber(): number } | number;
}

/**
 * Reserve available pallets (FIFO) + create PickLine records.
 * Call once per OUT transaction on APPROVED.
 * Throws BAD_REQUEST if insufficient pallets are available.
 */
export const reservePalletsAndCreatePickLines = async (
    db: DbClient,
    locale: ServerLocale,
    params: {
        transactionType: WarehouseTransactionType;
        documentId: string;
        warehouseId: string;
        items: DispatchItem[];
    },
) => {
    for (const item of params.items) {
        const count = Math.round(
            typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber(),
        );
        if (count <= 0) continue;

        const pallets = await db.pallet.findMany({
            where: {
                skuId: item.skuId,
                status: 'AVAILABLE',
                storageLocationId: { not: null },
                storageLocation: { warehouseId: params.warehouseId },
            },
            orderBy: { createdAt: 'asc' }, // FIFO
            take: count,
            select: { id: true, storageLocationId: true },
        });

        if (pallets.length < count) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: getMessage(locale, 'transaction.insufficientStock', {
                    skuId: item.skuId,
                    needed: count,
                    available: pallets.length,
                }),
            });
        }

        await db.pallet.updateMany({
            where: { id: { in: pallets.map((p) => p.id) } },
            data: { status: 'NOT_AVAILABLE' },
        });

        await db.pickLine.createMany({
            data: pallets.map((pallet) => ({
                transactionType: params.transactionType,
                documentId: params.documentId,
                palletId: pallet.id,
                fromLocationId: pallet.storageLocationId,
            })),
        });
    }
};

// ===========================================================
// DEFERRED STOCK MOVEMENT WRITER
// Fetches the document by type + id and calls writeStockMovements.
// Called when ALL putaway/pick lines are completed — not on approve.
// ===========================================================

type StockMovementDocumentRow = {
    warehouseId: string;
    date: Date;
    documentNumber: string | null;
    items: { skuId: string; quantity: { toNumber(): number } | number }[];
};

async function fetchDocumentForStockMovement(
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
): Promise<StockMovementDocumentRow> {
    const itemSelect = { select: { skuId: true, quantity: true } } as const;

    switch (transactionType) {
        case 'RECEIVING': {
            const doc = await db.receivingTransaction.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, purchaseOrderRef: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.purchaseOrderRef ?? null, items: doc.items };
        }
        case 'WIP_COMPLETION': {
            const doc = await db.wipCompletion.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'RMA_RECEIPT': {
            const doc = await db.rmaReceipt.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'FOUND': {
            const doc = await db.foundTransaction.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'WIP_ISSUE': {
            const doc = await db.wipIssue.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'SHIPMENT': {
            const doc = await db.shipment.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'RETURN_TO_SUPPLIER': {
            const doc = await db.returnToSupplier.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        case 'DISPOSAL': {
            const doc = await db.disposal.findUniqueOrThrow({
                where: { id: documentId },
                select: { warehouseId: true, date: true, reference: true, items: itemSelect },
            });
            return { warehouseId: doc.warehouseId, date: doc.date, documentNumber: doc.reference ?? null, items: doc.items };
        }
        default:
            throw new Error(`writeStockMovementsFromDocument: unsupported transactionType ${transactionType}`);
    }
}

/**
 * Fetch a transaction document's items and write stock movements + update inventory balances.
 * Call this when all PutawayLines (IN) or PickLines (OUT) for the document are COMPLETED,
 * NOT on document approval.
 */
export const writeStockMovementsFromDocument = async (
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
    direction: MovementDirection,
    postedById: string,
): Promise<void> => {
    const doc = await fetchDocumentForStockMovement(db, transactionType, documentId);
    await writeStockMovements(db, {
        transactionType,
        direction,
        documentId,
        documentNumber: doc.documentNumber,
        warehouseId: doc.warehouseId,
        transactionDate: doc.date,
        postedById,
        items: doc.items.map((item) => ({
            skuId: item.skuId,
            quantity: item.quantity,
        })),
    });
};

