import { TRPCError } from "@trpc/server";
import { getMessage, type ServerLocale } from "./locale.js";
import type { DbClient } from "./prisma.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import type { WarehouseTransactionType, MovementDirection } from "../prisma/generated/client.js";

export interface TransactionItemIdentity {
    skuId: string;
    palletTypeId: string;
}

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
        const key = `${item.skuId}:${item.palletTypeId}`;
        if (keys.has(key)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, duplicateItemMessageKey),
            });
        }
        keys.add(key);
    }
};

export const ensureTransactionPalletTypesMatchSku = async (
    db: DbClient,
    items: TransactionItemIdentity[],
    locale: ServerLocale,
    messageKeys: {
        palletTypeNotFound: string;
        palletTypeMismatch: string;
    },
) => {
    const palletTypeIds = items.map((item) => item.palletTypeId);
    const palletTypeRows = await db.palletType.findMany({
        where: { id: { in: palletTypeIds } },
        select: { id: true, skuId: true },
    });

    const skuByPalletTypeId = new Map(palletTypeRows.map((row) => [row.id, row.skuId]));

    for (const item of items) {
        const skuId = skuByPalletTypeId.get(item.palletTypeId);
        if (!skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, messageKeys.palletTypeNotFound, {
                    palletTypeId: item.palletTypeId,
                }),
            });
        }
        if (skuId !== item.skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, messageKeys.palletTypeMismatch, {
                    palletTypeId: item.palletTypeId,
                    skuId: item.skuId,
                }),
            });
        }
    }
};



export const ensureDraftOnly = (
    approvalStatus: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status DRAFT.",
) => {
    if (approvalStatus !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureDraftOrRejected = (
    approvalStatus: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status DRAFT atau REJECTED.",
) => {
    if (approvalStatus !== "DRAFT" && approvalStatus !== "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureActionableApprovalStatus = (
    approvalStatus: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status PROPOSED.",
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
    approvalStatus?: ApprovalStatus;
    dateFrom?: Date;
    dateTo?: Date;
}): Record<string, unknown> => ({
    ...(input?.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
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
    palletTypeId: string;
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
                palletTypeId: item.palletTypeId,
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
    palletTypeId: string;
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
    for (const item of params.items) {
        const count = Math.round(
            typeof item.quantity === 'number' ? item.quantity : item.quantity.toNumber(),
        );
        if (count <= 0) continue;

        // Create pallets one by one to capture their IDs
        const pallets = await Promise.all(
            Array.from({ length: count }, () =>
                db.pallet.create({
                    data: {
                        palletTypeId: item.palletTypeId,
                        sourceType: params.transactionType,
                        sourceItemId: item.itemId,
                        status: 'AVAILABLE',
                    },
                    select: { id: true },
                }),
            ),
        );

        await db.putawayLine.createMany({
            data: pallets.map((pallet) => ({
                transactionType: params.transactionType,
                documentId: params.documentId,
                palletId: pallet.id,
            })),
        });
    }
};

// ===========================================================
// DISPATCH (PICK) HELPERS (OUT transactions)
// ===========================================================

export interface DispatchItem {
    palletTypeId: string;
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
                palletTypeId: item.palletTypeId,
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
                message: `Stok tidak mencukupi untuk pallet type ${item.palletTypeId}: butuh ${count}, tersedia ${pallets.length}`,
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
    items: { skuId: string; palletTypeId: string; quantity: { toNumber(): number } | number }[];
};

async function fetchDocumentForStockMovement(
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
): Promise<StockMovementDocumentRow> {
    const itemSelect = { select: { skuId: true, palletTypeId: true, quantity: true } } as const;

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
            palletTypeId: item.palletTypeId,
            quantity: item.quantity,
        })),
    });
};

