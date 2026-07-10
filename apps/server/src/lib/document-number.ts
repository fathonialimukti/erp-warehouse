import { TRPCError } from '@trpc/server';
import type { DbClient } from './prisma.js';
import type { WarehouseTransactionType } from '../prisma/generated/client.js';

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

const formatDocumentNumber = (type: WarehouseTransactionType, warehouseCode: string, date: Date, index: number) => {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear());
    const paddedIndex = String(index).padStart(4, '0');
    return `${TX_CODE[type]}/${warehouseCode}/${month}/${year}/${paddedIndex}`;
};

const parseDocumentNumberIndex = (documentNumber: string): number => {
    const parts = documentNumber.split('/');
    const suffix = parts[parts.length - 1];
    const index = Number(suffix);
    return Number.isFinite(index) && index >= 0 ? index : 0;
};

const findLastDocumentNumber = async (
    db: DbClient,
    type: WarehouseTransactionType,
    prefix: string,
) => {
    switch (type) {
        case 'RECEIVING':
            return db.receivingTransaction.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'SHIPMENT':
            return db.shipment.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'WIP_COMPLETION':
            return db.wipCompletion.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'RMA_RECEIPT':
            return db.rmaReceipt.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'WIP_ISSUE':
            return db.wipIssue.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'RETURN_TO_SUPPLIER':
            return db.returnToSupplier.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'DISPOSAL':
            return db.disposal.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'SUBINVENTORY_TRANSFER':
            return db.subinventoryTransfer.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'LOSS':
            return db.lossTransaction.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        case 'FOUND':
            return db.foundTransaction.findFirst({
                where: { documentNumber: { startsWith: prefix } },
                orderBy: { documentNumber: 'desc' },
                select: { documentNumber: true },
            });
        default:
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Unsupported transaction type: ${type}` });
    }
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
    const prefix = `${TX_CODE[params.transactionType]}/${warehouseCode}/${String(params.date.getUTCMonth() + 1).padStart(2, '0')}/${String(params.date.getUTCFullYear())}`;
    const last = await findLastDocumentNumber(db, params.transactionType, prefix);
    const lastDocumentNumber = last?.documentNumber;
    const nextIndex = lastDocumentNumber ? parseDocumentNumberIndex(lastDocumentNumber) + 1 : 1;

    return formatDocumentNumber(params.transactionType, warehouseCode, params.date, nextIndex);
};
