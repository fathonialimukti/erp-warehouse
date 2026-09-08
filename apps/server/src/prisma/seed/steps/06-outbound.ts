import type { DbClient } from "../../../lib/prisma.js";
import { getNextDocumentNumber } from "../../../lib/document-number.js";
import { isoContainerId } from "../lib/iso6346.js";
import type { LocationPool } from "../lib/location-pool.js";
import type { MasterIds } from "./02-master.js";
import type { PlanEvent } from "./03-schedule.js";
import { MONTHS_12 } from "../catalog/plans.js";
import { CARRIERS, DISTRIBUTORS } from "../catalog/partners.js";

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

const CONTAINER_OWNERS = ["MAEU", "MSCU", "CMCU", "HLXU", "ONEU"] as const;

/**
 * Creates SHIPMENT documents (raw components → contract assembler from WH01,
 * finished goods → EU distributors from WH03), their pick lines, pallet
 * consumption and OUT stock movements. Deterministic.
 */
export async function runShipments(
  db: DbClient,
  ids: MasterIds,
  events: PlanEvent[],
  pool: LocationPool,
  ctx: { approver: string; operator: string },
): Promise<void> {
  let eventIndex = 0;
  const containerSerial = 200000;

  for (const e of events) {
    if (e.type !== "SHIPMENT") continue;

    const date = eventDate(e);
    const warehouseId = ids.warehouse[e.warehouseCode];
    const skuId = ids.sku[e.skuCode];
    if (!warehouseId || !skuId) {
      throw new Error(`shipment: missing id for ${e.skuCode}@${e.warehouseCode}`);
    }

    const owner = CONTAINER_OWNERS[eventIndex % CONTAINER_OWNERS.length]!;
    const containerId = isoContainerId(owner, containerSerial + eventIndex);
    const carrier = CARRIERS[eventIndex % CARRIERS.length]!.name;
    // WH01 ships raw material to the assembler; WH03 ships FG to EU distributors.
    const recipient =
      e.warehouseCode === "WH01"
        ? "Rotterdam Contract Assembly B.V."
        : DISTRIBUTORS[eventIndex % DISTRIBUTORS.length]!.name;
    const approvedAt = new Date(date.getTime() + 90 * 60 * 1000);

    // 30s timeout / 15s maxWait — same as the app's transactional middleware.
    await db.$transaction(
      async (tx) => {
        const documentNumber = await getNextDocumentNumber(tx, {
          transactionType: "SHIPMENT",
          warehouseId,
          date,
        });

      const header = await tx.shipment.create({
        data: {
          documentNumber,
          date,
          shipmentNumber: documentNumber,
          salesOrderRef: `SO-${containerId}`,
          recipient,
          reference: documentNumber,
          notes: `Outbound ${e.skuCode} — ${e.pallets} pallet(s), ${e.cartons} cartons`,
          carrier,
          trackingNumber: containerId,
          warehouseId,
          createdById: ctx.operator,
          approvedById: ctx.approver,
          approvedAt,
          approvalStatus: "APPROVED",
          dispatchStatus: "COMPLETED",
          dispatchOpenStatus: "CLOSED",
          approvalHistory: approvalHistory(ctx.approver, approvedAt),
        },
        select: { id: true },
      });

      await tx.shipmentItem.create({
        data: {
          shipmentId: header.id,
          skuId,
          quantity: e.cartons,
          details: `${e.pallets} pallet(s) of ${e.skuCode}`,
        },
      });

      // FIFO pick of AVAILABLE pallets of this SKU in this warehouse.
      const pallets = await tx.pallet.findMany({
        where: {
          skuId,
          status: "AVAILABLE",
          storageLocation: { warehouseId },
        },
        orderBy: { createdAt: "asc" },
        take: e.pallets,
        select: { id: true, storageLocationId: true },
      });
      if (pallets.length < e.pallets) {
        throw new Error(
          `shipment: need ${e.pallets} AVAILABLE pallets of ${e.skuCode} in ${e.warehouseCode}, have ${pallets.length}`,
        );
      }

      for (const p of pallets) {
        await tx.pickLine.create({
          data: {
            transactionType: "SHIPMENT",
            documentId: header.id,
            palletId: p.id,
            fromLocationId: p.storageLocationId,
            status: "COMPLETED",
            assignedAt: approvedAt,
            assignedById: ctx.operator,
            completedAt: approvedAt,
            completedById: ctx.operator,
          },
        });
        await tx.pallet.update({
          where: { id: p.id },
          data: { status: "NOT_AVAILABLE", storageLocationId: null },
        });
        if (p.storageLocationId) pool.release(p.storageLocationId);
      }

      await tx.stockMovement.create({
        data: {
          transactionType: "SHIPMENT",
          direction: "OUT",
          documentId: header.id,
          documentNumber,
          skuId,
          warehouseId,
          quantity: e.cartons,
          signedQty: -e.cartons,
          transactionDate: date,
          postedById: ctx.approver,
          notes: `Auto-generated outbound for ${documentNumber}`,
        },
      });
      },
      { timeout: 30_000, maxWait: 15_000 },
    );

    eventIndex++;
  }
}
