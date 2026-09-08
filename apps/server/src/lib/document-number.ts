import { TRPCError } from '@trpc/server';
import type { DbClient } from './prisma.js';
import type { WarehouseTransactionType, PrismaClient } from '../prisma/generated/client.js';

type ModelDelegate = { findFirst: (...args: never[]) => unknown };
type ModelKey = { [K in keyof PrismaClient]: PrismaClient[K] extends ModelDelegate ? K : never }[keyof PrismaClient];
type FindFirstDelegate = { findFirst: (args: { where: { documentNumber: { startsWith: string } }; orderBy: { documentNumber: 'desc' }; select: { documentNumber: true } }) => Promise<{ documentNumber: string } | null> };

export const TX_CODE: Record<WarehouseTransactionType, string> = {
    RECEIVING: 'RCV',
    WIP_COMPLETION: 'WCP',
    RMA_RECEIPT: 'RMA',
    WIP_ISSUE: 'WIS',
    SHIPMENT: 'SHP',
    RETURN_TO_SUPPLIER: 'RTS',
    DISPOSAL: 'DSP',
    SUBINVENTORY_TRANSFER: 'TRF',
    LOSS: 'LOS',
    FOUND: 'FND',
};

const getWarehouseCode = (warehouse: { id: string; code?: string | null; objectId?: string | null }) => {
    const code = warehouse.code?.trim();
    if (code && code.length > 0) {
        return code;
    }

    const objectId = warehouse.objectId?.trim();
    if (objectId && objectId.length > 0) {
        return objectId;
    }

    return warehouse.id.slice(0, 4).toUpperCase();
};

const formatDocumentNumberPrefix = (type: WarehouseTransactionType, warehouseCode: string, date: Date) =>
    `${TX_CODE[type]}/${warehouseCode}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCFullYear())}`;

const formatDocumentNumber = (type: WarehouseTransactionType, warehouseCode: string, date: Date, index: number) => {
    const paddedIndex = String(index).padStart(4, '0');
    return `${formatDocumentNumberPrefix(type, warehouseCode, date)}/${paddedIndex}`;
};

const parseDocumentNumberIndex = (documentNumber: string): number => {
    const parts = documentNumber.split('/');
    const suffix = parts[parts.length - 1];
    const index = Number(suffix);
    return Number.isFinite(index) && index >= 0 ? index : 0;
};

const DOCUMENT_MODEL_BY_TYPE: Record<WarehouseTransactionType, ModelKey> = {
    RECEIVING: 'receivingTransaction',
    WIP_COMPLETION: 'wipCompletion',
    RMA_RECEIPT: 'rmaReceipt',
    WIP_ISSUE: 'wipIssue',
    SHIPMENT: 'shipment',
    RETURN_TO_SUPPLIER: 'returnToSupplier',
    DISPOSAL: 'disposal',
    SUBINVENTORY_TRANSFER: 'subinventoryTransfer',
    LOSS: 'lossTransaction',
    FOUND: 'foundTransaction',
};

const findLastDocumentNumber = async (db: DbClient, type: WarehouseTransactionType, prefix: string) => {
    const model = DOCUMENT_MODEL_BY_TYPE[type];
    const delegate = db[model] as unknown as FindFirstDelegate;
    return delegate.findFirst({
        where: { documentNumber: { startsWith: prefix } },
        orderBy: { documentNumber: 'desc' },
        select: { documentNumber: true },
    });
};

export const getNextDocumentNumber = async (
    db: DbClient,
    params: { transactionType: WarehouseTransactionType; warehouseId: string; date: Date },
) => {
    const warehouse = await db.warehouse.findUnique({
        where: { id: params.warehouseId },
        select: { id: true, code: true, objectId: true },
    });
    if (!warehouse) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Warehouse ${params.warehouseId} not found` });
    }

    const warehouseCode = getWarehouseCode(warehouse);
    const prefix = formatDocumentNumberPrefix(params.transactionType, warehouseCode, params.date);
    const last = await findLastDocumentNumber(db, params.transactionType, prefix);
    const lastDocumentNumber = last?.documentNumber;
    const nextIndex = lastDocumentNumber ? parseDocumentNumberIndex(lastDocumentNumber) + 1 : 1;

    return formatDocumentNumber(params.transactionType, warehouseCode, params.date, nextIndex);
};

/** Document numbers for non-transaction documents (cycle counts, purchase orders, adjustments). */
export const getNextDocumentNumberByCode = async (
    db: DbClient,
    params: { code: string; model: ModelKey; warehouseId: string; date: Date },
) => {
    const warehouse = await db.warehouse.findUnique({
        where: { id: params.warehouseId },
        select: { id: true, code: true, objectId: true },
    });
    if (!warehouse) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Warehouse ${params.warehouseId} not found` });
    }

    const warehouseCode = getWarehouseCode(warehouse);
    const prefix = `${params.code}/${warehouseCode}/${String(params.date.getUTCMonth() + 1).padStart(2, '0')}/${params.date.getUTCFullYear()}`;
    const delegate = db[params.model] as unknown as FindFirstDelegate;
    const last = await delegate.findFirst({
        where: { documentNumber: { startsWith: prefix } },
        orderBy: { documentNumber: 'desc' },
        select: { documentNumber: true },
    });
    const nextIndex = last?.documentNumber ? parseDocumentNumberIndex(last.documentNumber) + 1 : 1;
    return `${prefix}/${String(nextIndex).padStart(4, '0')}`;
};
