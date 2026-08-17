import type { DbClient } from "../../../lib/prisma.js";
import { getNextDocumentNumber } from "../../../lib/document-number.js";
import { getNextPalletNumber } from "../../../lib/pallet-number.js";
import type { LocationPool } from "../lib/location-pool.js";
import type { MasterIds } from "./02-master.js";
import type { PlanEvent } from "./03-schedule.js";
import { MONTHS_12 } from "../catalog/plans.js";
import { SKU_SUPPLIER } from "../catalog/partners.js";

const monthStart = (monthIndex: number): Date => {
  const [y, m] = MONTHS_12[monthIndex]!.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
};

const eventDate = (e: PlanEvent): Date => {
  const start = monthStart(e.monthIndex);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), e.dayOffset));
};

const approvalHistory = (approver: string, at: Date) => [
  { action: "APPROVED", by: approver, at: at.toISOString() },
];

/** FIFO pick of `count` AVAILABLE pallets of `skuId` in `warehouseId`. */
const pickPallets = async (
  db: DbClient,
  warehouseId: string,
  skuId: string,
  count: number,
): Promise<{ id: string; storageLocationId: string | null }[]> => {
  const rows = await db.pallet.findMany({
    where: {
      skuId,
      status: "AVAILABLE",
      storageLocation: { warehouseId },
    },
    orderBy: { createdAt: "asc" },
    take: count,
    select: { id: true, storageLocationId: true },
  });
  if (rows.length < count) {
    throw new Error(
      `internal: need ${count} AVAILABLE pallets of sku ${skuId} in warehouse ${warehouseId}, have ${rows.length}`,
    );
  }
  return rows;
};

/** Consume pallets (OUT): pick line + NOT_AVAILABLE + release location. */
const consumePallets = async (
  db: DbClient,
  pool: LocationPool,
  tx: Parameters<Parameters<DbClient["$transaction"]>[0]>[0],
  transactionType: "SHIPMENT" | "RETURN_TO_SUPPLIER" | "DISPOSAL" | "LOSS",
  documentId: string,
  pallets: { id: string; storageLocationId: string | null }[],
  at: Date,
  operator: string,
): Promise<void> => {
  for (const p of pallets) {
    await tx.pickLine.create({
      data: {
        transactionType,
        documentId,
        palletId: p.id,
        fromLocationId: p.storageLocationId,
        status: "COMPLETED",
        assignedAt: at,
        assignedById: operator,
        completedAt: at,
        completedById: operator,
      },
    });
    await tx.pallet.update({
      where: { id: p.id },
      data: { status: "NOT_AVAILABLE", storageLocationId: null },
    });
    if (p.storageLocationId) pool.release(p.storageLocationId);
  }
};

/** Inbound pallets (IN): create pallet + putaway line + assign location. */
const receivePallets = async (
  db: DbClient,
  pool: LocationPool,
  tx: Parameters<Parameters<DbClient["$transaction"]>[0]>[0],
  transactionType: "RMA_RECEIPT" | "FOUND",
  documentId: string,
  itemId: string,
  skuId: string,
  warehouseId: string,
  count: number,
  date: Date,
  at: Date,
  operator: string,
): Promise<void> => {
  const locations = await pool.take(warehouseId, count);
  for (let i = 0; i < count; i++) {
    const palletNumber = await getNextPalletNumber(tx, date);
    const pallet = await tx.pallet.create({
      data: {
        palletNumber,
        skuId,
        storageLocationId: null,
        status: "AVAILABLE",
        sourceType: transactionType,
        sourceItemId: itemId,
      },
      select: { id: true },
    });
    await tx.putawayLine.create({
      data: {
        transactionType,
        documentId,
        palletId: pallet.id,
        storageLocationId: locations[i]!,
        status: "COMPLETED",
        completedAt: at,
        completedById: operator,
      },
    });
    await tx.pallet.update({
      where: { id: pallet.id },
      data: { storageLocationId: locations[i]! },
    });
  }
};

/**
 * Internal/adjustment transactions: RMA, RTS, DISPOSAL, LOSS, FOUND, TRANSFER.
 * Deterministic; quantities are whole cartons from the plan.
 */
export async function runInternal(
  db: DbClient,
  ids: MasterIds,
  events: PlanEvent[],
  pool: LocationPool,
  ctx: { approver: string; operator: string },
): Promise<void> {
  for (const e of events) {
    const date = eventDate(e);
    const warehouseId = ids.warehouse[e.warehouseCode];
    const skuId = ids.sku[e.skuCode];
    if (!warehouseId || !skuId) {
      throw new Error(`internal: missing id for ${e.skuCode}@${e.warehouseCode}`);
    }
    const approvedAt = new Date(date.getTime() + 60 * 60 * 1000);

    if (e.type === "RMA") {
      // FG returns → WH02 (quality hold). Link to the latest shipment of that SKU.
      const original = await db.shipment.findFirst({
        where: { items: { some: { skuId } } },
        orderBy: { date: "desc" },
        select: { id: true, salesOrderRef: true },
      });
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "RMA_RECEIPT",
            warehouseId,
            date,
        });
        const header = await tx.rmaReceipt.create({
          data: {
            documentNumber,
            date,
            originalShipmentId: original?.id ?? null,
            salesOrderRef: original?.salesOrderRef ?? null,
            returnReason: "defective unit",
            reference: documentNumber,
            notes: `RMA intake ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            putawayStatus: "COMPLETED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        const item = await tx.rmaReceiptItem.create({
          data: {
            rmaReceiptId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
          select: { id: true },
        });
        await receivePallets(db, pool, tx, "RMA_RECEIPT", header.id, item.id, skuId, warehouseId, e.pallets, date, approvedAt, ctx.operator);
        await tx.stockMovement.create({
          data: {
            transactionType: "RMA_RECEIPT",
            direction: "IN",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated RMA intake for ${documentNumber}`,
          },
        });
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }

    if (e.type === "FOUND") {
      // Cycle-count recovery → WH01.
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "FOUND",
          warehouseId,
          date,
        });
        const header = await tx.foundTransaction.create({
          data: {
            documentNumber,
            date,
            foundReason: "cycle count recovery",
            foundLocation: "rack area",
            reference: documentNumber,
            notes: `Found stock ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            putawayStatus: "COMPLETED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        const item = await tx.foundTransactionItem.create({
          data: {
            foundTransactionId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
          select: { id: true },
        });
        await receivePallets(db, pool, tx, "FOUND", header.id, item.id, skuId, warehouseId, e.pallets, date, approvedAt, ctx.operator);
        await tx.stockMovement.create({
          data: {
            transactionType: "FOUND",
            direction: "IN",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated found stock for ${documentNumber}`,
          },
        });
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }

    if (e.type === "RTS") {
      // Defective component lot back to the supplying Asian supplier.
      const supplierCode = SKU_SUPPLIER[e.skuCode];
      const supplierId = supplierCode ? ids.supplier[supplierCode] : undefined;
      if (!supplierId) {
        throw new Error(`internal: no supplier for RTS of ${e.skuCode}`);
      }
      const original = await db.receivingTransaction.findFirst({
        where: { items: { some: { skuId } } },
        orderBy: { date: "desc" },
        select: { id: true },
      });
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "RETURN_TO_SUPPLIER",
          warehouseId,
          date,
        });
        const header = await tx.returnToSupplier.create({
          data: {
            documentNumber,
            date,
            supplierId,
            originalReceivingId: original?.id ?? null,
            returnReason: "quality issue",
            reference: documentNumber,
            notes: `Supplier return ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            dispatchStatus: "COMPLETED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        await tx.returnToSupplierItem.create({
          data: {
            returnToSupplierId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
        });
        const pallets = await pickPallets(db, warehouseId, skuId, e.pallets);
        await consumePallets(db, pool, tx, "RETURN_TO_SUPPLIER", header.id, pallets, approvedAt, ctx.operator);
        await tx.stockMovement.create({
          data: {
            transactionType: "RETURN_TO_SUPPLIER",
            direction: "OUT",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: -e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated supplier return for ${documentNumber}`,
          },
        });
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }

    if (e.type === "DISPOSAL") {
      // E-waste / damaged FG → WH02.
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "DISPOSAL",
          warehouseId,
          date,
        });
        const header = await tx.disposal.create({
          data: {
            documentNumber,
            date,
            disposalReason: "damaged during handling",
            reference: documentNumber,
            notes: `Disposal ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            dispatchStatus: "COMPLETED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        await tx.disposalItem.create({
          data: {
            disposalId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
        });
        const pallets = await pickPallets(db, warehouseId, skuId, e.pallets);
        await consumePallets(db, pool, tx, "DISPOSAL", header.id, pallets, approvedAt, ctx.operator);
        await tx.stockMovement.create({
          data: {
            transactionType: "DISPOSAL",
            direction: "OUT",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: -e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated disposal for ${documentNumber}`,
          },
        });
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }

    if (e.type === "LOSS") {
      // Unexplained shrinkage → WH01.
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "LOSS",
          warehouseId,
          date,
        });
        const header = await tx.lossTransaction.create({
          data: {
            documentNumber,
            date,
            lossReason: "cycle count variance",
            reference: documentNumber,
            notes: `Stock loss ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        await tx.lossTransactionItem.create({
          data: {
            lossTransactionId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
        });
        const pallets = await pickPallets(db, warehouseId, skuId, e.pallets);
        await consumePallets(db, pool, tx, "LOSS", header.id, pallets, approvedAt, ctx.operator);
        await tx.stockMovement.create({
          data: {
            transactionType: "LOSS",
            direction: "OUT",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: -e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated loss for ${documentNumber}`,
          },
        });
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }

    if (e.type === "TRANSFER") {
      // Internal slot move WH01 → WH03 (no stock movement — location change only).
      const toWarehouseId = ids.warehouse["WH03"]!;
      await db.$transaction(
        async (tx) => {
          const documentNumber = await getNextDocumentNumber(tx, {
            transactionType: "SUBINVENTORY_TRANSFER",
          warehouseId,
          date,
        });
        const header = await tx.subinventoryTransfer.create({
          data: {
            documentNumber,
            date,
            transferReason: "slot optimization",
            reference: documentNumber,
            notes: `Internal transfer ${e.skuCode} — ${e.pallets} pallet(s)`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            approvalHistory: approvalHistory(ctx.approver, approvedAt),
          },
          select: { id: true },
        });
        const pallets = await pickPallets(db, warehouseId, skuId, e.pallets);
        const toLocations = await pool.take(toWarehouseId, e.pallets);
        for (let i = 0; i < pallets.length; i++) {
          const p = pallets[i]!;
          await tx.subinventoryTransferItem.create({
            data: {
              subinventoryTransferId: header.id,
              palletId: p.id,
              fromLocationId: p.storageLocationId!,
              toLocationId: toLocations[i]!,
            },
          });
          await tx.pallet.update({
            where: { id: p.id },
            data: { storageLocationId: toLocations[i]! },
          });
          if (p.storageLocationId) pool.release(p.storageLocationId);
        }
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      continue;
    }
  }
}
