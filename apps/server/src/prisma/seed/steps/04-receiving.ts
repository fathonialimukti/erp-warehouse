import type { DbClient } from "../../../lib/prisma.js";
import { getNextDocumentNumber } from "../../../lib/document-number.js";
import { getNextPalletNumber } from "../../../lib/pallet-number.js";
import { isoContainerId } from "../lib/iso6346.js";
import type { LocationPool } from "../lib/location-pool.js";
import type { MasterIds } from "./02-master.js";
import type { PlanEvent } from "./03-schedule.js";
import { MONTHS_12 } from "../catalog/plans.js";
import { SKU_SUPPLIER, CARRIERS } from "../catalog/partners.js";

/** Deterministic driver/vehicle pool (rotating by event index — no faker). */
const DRIVERS = [
  { name: "Jan de Vries", contact: "+31-6-5550-0101", plate: "NL-101-AA" },
  { name: "Piotr Kowalski", contact: "+31-6-5550-0102", plate: "NL-202-BB" },
  { name: "Ahmed El-Sayed", contact: "+31-6-5550-0103", plate: "NL-303-CC" },
  { name: "Marco Rossi", contact: "+31-6-5550-0104", plate: "NL-404-DD" },
  { name: "Sofia Lindqvist", contact: "+31-6-5550-0105", plate: "NL-505-EE" },
] as const;

/** Container owner codes derived from real ocean carriers (ISO 6346, end in U). */
const CONTAINER_OWNERS = ["MAEU", "MSCU", "CMCU", "HLXU", "ONEU"] as const;

const monthStart = (monthIndex: number): Date => {
  const [y, m] = MONTHS_12[monthIndex]!.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
};

const eventDate = (e: PlanEvent): Date => {
  const start = monthStart(e.monthIndex);
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), e.dayOffset),
  );
};

/**
 * Creates RECEIVING documents (raw components → WH01, finished goods → WH03),
 * their putaway lines, pallets and IN stock movements. Deterministic.
 */
export async function runReceiving(
  db: DbClient,
  ids: MasterIds,
  events: PlanEvent[],
  pool: LocationPool,
  ctx: { approver: string; operator: string },
): Promise<void> {
  let eventIndex = 0;
  const containerSerial = 100000;

  for (const e of events) {
    if (e.type !== "RECEIVING") continue;

    const date = eventDate(e);
    const warehouseId = ids.warehouse[e.warehouseCode];
    const skuId = ids.sku[e.skuCode];
    const supplierCode = SKU_SUPPLIER[e.skuCode];
    if (!warehouseId || !skuId || !supplierCode) {
      throw new Error(
        `receiving: missing id for ${e.skuCode}@${e.warehouseCode} (supplier ${supplierCode ?? "unknown"})`,
      );
    }
    const supplierId = ids.supplier[supplierCode];
    if (!supplierId) {
      throw new Error(`receiving: supplier ${supplierCode} not seeded`);
    }

    const driver = DRIVERS[eventIndex % DRIVERS.length]!;
    const owner = CONTAINER_OWNERS[eventIndex % CONTAINER_OWNERS.length]!;
    const containerId = isoContainerId(owner, containerSerial + eventIndex);
    const carrier = CARRIERS[eventIndex % CARRIERS.length]!.name;
    const approvedAt = new Date(date.getTime() + 90 * 60 * 1000);

    // 30s timeout / 15s maxWait — same as the app's transactional middleware;
    // the default 5s interactive timeout is too short for batch pallet writes on a remote DB.
    await db.$transaction(
      async (tx) => {
        const documentNumber = await getNextDocumentNumber(tx, {
          transactionType: "RECEIVING",
          warehouseId,
          date,
        });

        const header = await tx.receivingTransaction.create({
          data: {
            documentNumber,
            date,
            supplierId,
            purchaseOrderRef: `PO-${containerId}`,
            deliveryNoteRef: `DN/${e.warehouseCode}/${String(eventIndex + 1).padStart(4, "0")}`,
            carrier,
            trackingNumber: containerId,
            driverName: driver.name,
            driverContact: driver.contact,
            vehiclePlate: driver.plate,
            notes: `Inbound ${e.skuCode} — ${e.pallets} pallet(s), ${e.cartons} cartons`,
            warehouseId,
            createdById: ctx.operator,
            approvedById: ctx.approver,
            approvedAt,
            approvalStatus: "APPROVED",
            putawayStatus: "COMPLETED",
            approvalHistory: [
              {
                action: "APPROVED",
                by: ctx.approver,
                at: approvedAt.toISOString(),
              },
            ],
          },
          select: { id: true },
        });

        const item = await tx.receivingTransactionItem.create({
          data: {
            receivingTransactionId: header.id,
            skuId,
            quantity: e.cartons,
            details: `${e.pallets} pallet(s) of ${e.skuCode}`,
          },
          select: { id: true },
        });

        const locations = await pool.take(warehouseId, e.pallets);
        for (let i = 0; i < e.pallets; i++) {
          const palletNumber = await getNextPalletNumber(tx, date);
          const pallet = await tx.pallet.create({
            data: {
              palletNumber,
              skuId,
              storageLocationId: null,
              status: "AVAILABLE",
              sourceType: "RECEIVING",
              sourceItemId: item.id,
            },
            select: { id: true },
          });
          await tx.putawayLine.create({
            data: {
              transactionType: "RECEIVING",
              documentId: header.id,
              palletId: pallet.id,
              storageLocationId: locations[i]!,
              status: "COMPLETED",
              completedAt: approvedAt,
              completedById: ctx.operator,
            },
          });
          await tx.pallet.update({
            where: { id: pallet.id },
            data: { storageLocationId: locations[i]! },
          });
        }

        await tx.stockMovement.create({
          data: {
            transactionType: "RECEIVING",
            direction: "IN",
            documentId: header.id,
            documentNumber,
            skuId,
            warehouseId,
            quantity: e.cartons,
            signedQty: e.cartons,
            transactionDate: date,
            postedById: ctx.approver,
            notes: `Auto-generated inbound for ${documentNumber}`,
          },
        });
      },
      { timeout: 30_000, maxWait: 15_000 },
    );

    eventIndex++;
  }
}
