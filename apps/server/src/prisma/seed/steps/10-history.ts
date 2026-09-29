import type { DbClient } from "../../../lib/prisma.js";
import { logActivity } from "../../../lib/activity-log.js";
import { notifyApprovalEvent } from "../../../lib/approval-notify.js";
import {
  getNextDocumentNumber,
  getNextDocumentNumberByCode,
} from "../../../lib/document-number.js";
import { DEFAULT_LOCALE } from "../../../lib/locale.js";
import { applyReceiptToPurchaseOrder } from "../../../lib/purchase-order.js";
import {
  buildApprovalActionData,
  createPalletsAndPutawayLines,
  reservePalletsAndCreatePickLines,
  writeStockMovements,
  writeStockMovementsFromDocument,
} from "../../../lib/transaction.js";
import type { WarehouseTransactionType } from "../../../prisma/generated/client.js";
import { isoContainerId } from "../lib/iso6346.js";
import type { LocationPool } from "../lib/location-pool.js";
import {
  HISTORY_DOCS,
  HISTORY_NOTE_PREFIX,
  MAINTENANCE_PER_WAREHOUSE,
  PO_UNIT_PRICE,
  PURCHASE_ORDERS,
  STOCK_COUNTS,
  type HistoryDoc,
  type HistoryType,
} from "../catalog/history.js";
import { MONTHS_12, SUPPLIER_LEAD_DAYS } from "../catalog/plans.js";
import { CARRIERS, SKU_SUPPLIER } from "../catalog/partners.js";
import { allSkuRows } from "../catalog/skus.js";
import type { MasterIds } from "./02-master.js";

type Tx = Parameters<Parameters<DbClient["$transaction"]>[0]>[0];

const TX_OPTIONS = { timeout: 30_000, maxWait: 15_000 } as const;

/** Which seeded user raises each kind of document, mirroring the seeded roles. */
export interface HistoryUsers {
  /** Signs documents off. */
  approver: string;
  /** Raises receiving and RMA documents. */
  operator: string;
  /** Raises supplier returns. */
  picker: string;
  /** Raises counts, losses and found stock. */
  counter: string;
  /** Raises purchase orders, component issues and transfers. */
  planner: string;
}

export interface HistoryCounts {
  purchaseOrders: number;
  receipts: number;
  wipIssues: number;
  wipCompletions: number;
  losses: number;
  founds: number;
  rmaReceipts: number;
  returnsToSupplier: number;
  disposals: number;
  transfers: number;
  stockCounts: number;
}

const CARTONS_PER_PALLET = new Map(
  allSkuRows().map((s) => [s.code, s.packagesPerPallet]),
);

/** Permission prefix, detail route and activity resource, as the routers use. */
const TX_INFO: Record<
  HistoryType,
  { resource: string; route: string; activity: string; label: string }
> = {
  WIP_ISSUE: {
    resource: "wip-issue",
    route: "/outbound-transaction/wip-issue",
    activity: "wip_issue",
    label: "WIP issue",
  },
  LOSS: {
    resource: "loss",
    route: "/outbound-transaction/loss",
    activity: "loss_transaction",
    label: "loss transaction",
  },
  FOUND: {
    resource: "found",
    route: "/inbound-transaction/found",
    activity: "found_transaction",
    label: "found transaction",
  },
  RMA_RECEIPT: {
    resource: "rma-receipt",
    route: "/inbound-transaction/rma-receipt",
    activity: "rma_receipt",
    label: "RMA receipt",
  },
  RETURN_TO_SUPPLIER: {
    resource: "return-to-supplier",
    route: "/outbound-transaction/return-to-supplier",
    activity: "return_to_supplier",
    label: "return to supplier",
  },
  SUBINVENTORY_TRANSFER: {
    resource: "subinventory-transfer",
    route: "/subinventory-transfer",
    activity: "subinventory_transfer",
    label: "subinventory transfer",
  },
  WIP_COMPLETION: {
    resource: "wip-completion",
    route: "/inbound-transaction/wip-completion",
    activity: "wip_completion",
    label: "WIP completion",
  },
  DISPOSAL: {
    resource: "disposal",
    route: "/outbound-transaction/disposal",
    activity: "disposal",
    label: "disposal",
  },
};

const RECEIVING_INFO = {
  resource: "receiving",
  route: "/inbound-transaction/receiving",
  activity: "receiving_transaction",
  label: "receiving transaction",
};

const DEFAULT_LEAD_DAYS = 21;

const note = (text: string) => `${HISTORY_NOTE_PREFIX} ${text}`;

const eventDate = (monthIndex: number, day: number): Date => {
  const [year, month] = MONTHS_12[monthIndex]!.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day));
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const cartonsOf = (skuCode: string, pallets: number) =>
  pallets * (CARTONS_PER_PALLET.get(skuCode) ?? 1);

/**
 * Approval trail in the shape `buildApprovalActionData` writes: the proposal
 * that was submitted, then the sign-off. The workflow routers only approve a
 * PROPOSED document, so the history is written that way rather than dropped in
 * as a single APPROVED row.
 */
const approvalTrail = (at: Date) => [
  {
    process: "PROPOSED",
    userName: "seed",
    timeframe: at.toISOString(),
    message: "Submitted for approval.",
  },
  {
    process: "APPROVED",
    userName: "seed",
    timeframe: new Date(at.getTime() + 60 * 60 * 1000).toISOString(),
    message: "Approved against the paperwork.",
  },
];

type PendingNotification = {
  transactionType: WarehouseTransactionType;
  resource: string;
  documentId: string;
  documentNumber: string | null;
  actionUrl: string;
  actorId: string;
  actorName: string;
  status: "PROPOSED" | "APPROVED";
};

/**
 * Twelve months of paperwork for the domains the monthly plan in
 * `03-schedule.ts` does not produce: purchase orders, WIP issues, cycle
 * counts, and enough loss / found / RMA / return-to-supplier / transfer
 * documents that every transaction list and report has a trend to draw.
 *
 * Everything is written through the helpers the routers call —
 * `getNextDocumentNumber(ByCode)`, `buildApprovalActionData`,
 * `createPalletsAndPutawayLines`, `reservePalletsAndCreatePickLines`,
 * `writeStockMovements(FromDocument)`, `applyReceiptToPurchaseOrder`,
 * `notifyApprovalEvent`, `logActivity` — so the rows are indistinguishable from
 * real app output: same document numbering, same DRAFT → PROPOSED → APPROVED
 * trail, same pallet reservations and putaway lines, same stock movements, same
 * notifications.
 *
 * Units follow `04-receiving` / `05-internal`: a document line carries cartons
 * and the pallet helpers are handed the pallet count, so the pallet count and
 * the stock movement both move together. Every outbound pallet either draws on
 * the one-pallet buffer the plan builds in months 0-5 or on a same-month goods
 * receipt in months 6-11, which keeps `07-balances.ts` out of negative
 * territory.
 *
 * Idempotent: `clearHistory` removes everything the previous run wrote (matched
 * on the note prefix), releases the stock it consumed and drops the pallets it
 * received before rebuilding the same history.
 *
 * `monthWindow` (default: the full 12) slices every catalog by `monthIndex` the
 * same way `index.ts` slices `buildPlan()`. Without it `SEED_MONTHS=3` still
 * wrote twelve months of paperwork, drawing on stock the three-month plan had
 * never created.
 */
export async function runHistory(
  db: DbClient,
  ids: MasterIds,
  pool: LocationPool,
  users: HistoryUsers,
  monthWindow: number = MONTHS_12.length,
): Promise<HistoryCounts> {
  await clearHistory(db);

  const inWindow = <T extends { monthIndex: number }>(rows: T[]): T[] =>
    rows.filter((r) => r.monthIndex < monthWindow);
  const purchaseOrders = inWindow(PURCHASE_ORDERS);
  const historyDocs = inWindow(HISTORY_DOCS);
  const stockCounts = inWindow(STOCK_COUNTS);

  const wh = (code: string) => {
    const id = ids.warehouse[code];
    if (!id) throw new Error(`history: warehouse ${code} not seeded`);
    return id;
  };
  const sku = (code: string) => {
    const id = ids.sku[code];
    if (!id) throw new Error(`history: sku ${code} not seeded`);
    return id;
  };
  const supplierOf = (code: string) => {
    const id = ids.supplier[code];
    if (!id) throw new Error(`history: supplier ${code} not seeded`);
    return id;
  };

  const names = new Map(
    (
      await db.user.findMany({
        where: { id: { in: Object.values(users) } },
        select: { id: true, name: true },
      })
    ).map((user) => [user.id, user.name ?? "Unknown user"]),
  );
  const nameOf = (userId: string) => names.get(userId) ?? "Unknown user";

  const notifications: PendingNotification[] = [];
  const enqueue = (
    type: WarehouseTransactionType,
    info: { resource: string; route: string },
    documentId: string,
    documentNumber: string | null,
    actorId: string,
    status: "PROPOSED" | "APPROVED",
  ) => {
    notifications.push({
      transactionType: type,
      resource: info.resource,
      documentId,
      documentNumber,
      actionUrl: `${info.route}/${documentId}`,
      actorId,
      actorName: nameOf(actorId),
      status,
    });
  };

  // ─── 1. Pack the occupied slots to the front of every warehouse ────────────
  // The plan hands out locations lowest-id-first and releases them as goods
  // ship, so a full run leaves the racks ragged. Re-slotting them onto the
  // lowest free slot is what a floor team does after a peak, and it is what
  // makes `dashboard.warehouseAllocations` able to read occupancy at all.
  const reslotted = await reslotOccupiedLocations(db, wh);

  // ─── 2. Purchase orders and their goods receipts ───────────────────────────
  let receiptCount = 0;

  for (const [index, plan] of purchaseOrders.entries()) {
    const date = eventDate(plan.monthIndex, plan.day);
    const warehouseId = wh(plan.warehouseCode);
    const supplierId = supplierOf(plan.supplierCode);
    const leadDays =
      SUPPLIER_LEAD_DAYS[plan.lines[0]!.skuCode] ?? DEFAULT_LEAD_DAYS;
    const expectedDate = addDays(date, leadDays);
    const receivedLines = plan.receivedLines ?? [];
    // A goods receipt can only be applied to an APPROVED or RECEIVING order
    // (`applyReceiptToPurchaseOrder`), and it is what moves the order on to
    // RECEIVING / CLOSED — so an order with a receipt is raised APPROVED and
    // ends up where the catalog says it does.
    const openStatus = receivedLines.length > 0 ? "APPROVED" : plan.status;
    const approved = openStatus !== "DRAFT" && openStatus !== "PROPOSED";
    const approvedAt = new Date(date.getTime() + 6 * 60 * 60 * 1000);

    const order = await db.$transaction(async (tx) => {
      const documentNumber = await getNextDocumentNumberByCode(tx, {
        code: "PO",
        model: "purchaseOrder",
        warehouseId,
        date,
      });
      const header = await tx.purchaseOrder.create({
        data: {
          documentNumber,
          date,
          expectedDate,
          supplierId,
          warehouseId,
          status: openStatus,
          notes: note(plan.note),
          createdById: users.planner,
          approvedById: approved ? users.approver : null,
          approvedAt: approved ? approvedAt : null,
          approvalHistory: approved
            ? approvalTrail(approvedAt)
            : approvalTrail(date).slice(0, 1),
          items: {
            create: plan.lines.map((line) => ({
              skuId: sku(line.skuCode),
              quantity: cartonsOf(line.skuCode, line.pallets),
              unitPrice: PO_UNIT_PRICE[line.skuCode] ?? null,
              details: `${line.pallets} pallet(s) of ${line.skuCode}`,
            })),
          },
        },
        select: { id: true, documentNumber: true },
      });

      await logActivity(tx, {
        action: "CREATE",
        userId: users.planner,
        resource: "purchase_order",
        resourceId: header.id,
        message: `Created purchase order ${header.documentNumber}`,
        detail: { status: openStatus, lines: plan.lines.length },
      });
      if (approved) {
        await logActivity(tx, {
          action: "APPROVE",
          userId: users.approver,
          resource: "purchase_order",
          resourceId: header.id,
          message: `Approved purchase order ${header.documentNumber}`,
          detail: { before: { status: "PROPOSED" } },
        });
      }
      return header;
    }, TX_OPTIONS);

    if (receivedLines.length === 0) continue;

    // The goods receipt: a receiving document linked to the order, its pallets,
    // and the purchase-order update whose over-receipt guard must not trip —
    // the posted quantity is exactly what was ordered.
    const containerId = isoContainerId("MSCU", 810000 + index);
    const carrier = CARRIERS[index % CARRIERS.length]!.name;
    const receiptApprovedAt = new Date(expectedDate.getTime() + 90 * 60 * 1000);

    const receipt = await db.$transaction(async (tx) => {
      const documentNumber = await getNextDocumentNumber(tx, {
        transactionType: "RECEIVING",
        warehouseId,
        date: expectedDate,
      });
      const header = await tx.receivingTransaction.create({
        data: {
          documentNumber,
          date: expectedDate,
          supplierId,
          purchaseOrderId: order.id,
          purchaseOrderRef: order.documentNumber,
          deliveryNoteRef: `DN/${plan.warehouseCode}/${String(index + 1).padStart(4, "0")}`,
          carrier,
          trackingNumber: containerId,
          driverName: "Prins Logistics",
          driverContact: "+31-6-5550-0199",
          vehiclePlate: "NL-909-ZZ",
          notes: note(
            `Goods receipt against ${order.documentNumber} — ${receivedLines.length} line(s).`,
          ),
          warehouseId,
          createdById: users.operator,
          approvedById: users.approver,
          approvedAt: receiptApprovedAt,
          approvalStatus: "APPROVED",
          putawayStatus: "PENDING",
          approvalHistory: approvalTrail(receiptApprovedAt),
        },
        select: { id: true, documentNumber: true },
      });

      const lines: Array<{
        itemId: string;
        skuId: string;
        cartons: number;
        pallets: number;
        purchaseOrderItemId: string;
      }> = [];
      for (const line of receivedLines) {
        const poItem = await tx.purchaseOrderItem.findFirstOrThrow({
          where: { purchaseOrderId: order.id, skuId: sku(line.skuCode) },
          select: { id: true },
        });
        const item = await tx.receivingTransactionItem.create({
          data: {
            receivingTransactionId: header.id,
            skuId: sku(line.skuCode),
            quantity: cartonsOf(line.skuCode, line.pallets),
            details: `${line.pallets} pallet(s) of ${line.skuCode}`,
            purchaseOrderItemId: poItem.id,
          },
          select: { id: true },
        });
        lines.push({
          itemId: item.id,
          skuId: sku(line.skuCode),
          cartons: cartonsOf(line.skuCode, line.pallets),
          pallets: line.pallets,
          purchaseOrderItemId: poItem.id,
        });
      }

      // Approval, in the order the receiving router runs it: pallets +
      // putaway lines first, then the purchase-order receipt.
      await createPalletsAndPutawayLines(tx, {
        transactionType: "RECEIVING",
        documentId: header.id,
        items: lines.map((line) => ({
          itemId: line.itemId,
          skuId: line.skuId,
          quantity: line.pallets,
        })),
      });
      await applyReceiptToPurchaseOrder(tx, {
        purchaseOrderId: order.id,
        actorId: users.operator,
        actorName: nameOf(users.operator),
        receivingDocumentNumber: documentNumber,
        receivingId: header.id,
        lines: lines.map((line) => ({
          purchaseOrderItemId: line.purchaseOrderItemId,
          quantity: Math.round(line.cartons),
        })),
      });
      await logActivity(tx, {
        action: "CREATE",
        userId: users.operator,
        resource: RECEIVING_INFO.activity,
        resourceId: header.id,
        message: `Created receiving transaction ${documentNumber}`,
        detail: { purchaseOrder: order.documentNumber },
      });
      await logActivity(tx, {
        action: "APPROVE",
        userId: users.approver,
        resource: RECEIVING_INFO.activity,
        resourceId: header.id,
        message: `Approved receiving transaction ${documentNumber}`,
      });
      return header;
    }, TX_OPTIONS);

    // Rack the receipt: putaway lines stay PENDING and unassigned until the
    // floor racks them, exactly like a real delivery on the dock.
    await db.$transaction(async (tx) => {
      await completePutaway(tx, pool, "RECEIVING", receipt.id, warehouseId, {
        actorId: users.operator,
        postedById: users.approver,
        putawayModel: "RECEIVING",
      });
      await logActivity(tx, {
        action: "UPDATE",
        userId: users.operator,
        resource: RECEIVING_INFO.activity,
        resourceId: receipt.id,
        message: `Putaway completed for ${receipt.documentNumber}`,
      });
    }, TX_OPTIONS);
    receiptCount++;
    enqueue(
      "RECEIVING",
      RECEIVING_INFO,
      receipt.id,
      receipt.documentNumber,
      users.approver,
      "APPROVED",
    );
  }

  // ─── 3. Adjustment + component-issue documents ─────────────────────────────
  const counts: Record<HistoryType, number> = {
    WIP_ISSUE: 0,
    WIP_COMPLETION: 0,
    LOSS: 0,
    FOUND: 0,
    RMA_RECEIPT: 0,
    RETURN_TO_SUPPLIER: 0,
    DISPOSAL: 0,
    SUBINVENTORY_TRANSFER: 0,
  };
  const transferDocs = historyDocs.filter(
    (d) => d.type === "SUBINVENTORY_TRANSFER",
  );
  const movementDocs = historyDocs.filter(
    (d) => d.type !== "SUBINVENTORY_TRANSFER",
  );

  for (const doc of movementDocs) {
    const info = TX_INFO[doc.type];
    const date = eventDate(doc.monthIndex, doc.day);
    const warehouseId = wh(doc.warehouseCode);
    const skuId = sku(doc.skuCode);
    const creator = creatorFor(doc.type, users);

    const header = await createHistoryHeader(
      db,
      doc,
      { wh, sku, supplierOf },
      {
        date,
        warehouseId,
        skuId,
        creator,
      },
    );
    counts[doc.type]++;
    if (doc.status === "DRAFT") continue;

    if (doc.status === "APPROVED") {
      const items = await readItems(db, doc.type, header.id);
      await db.$transaction(async (tx) => {
        if (
          doc.type === "FOUND" ||
          doc.type === "RMA_RECEIPT" ||
          doc.type === "WIP_COMPLETION"
        ) {
          // approve(): pallets + putaway lines, exactly like the routers…
          await createPalletsAndPutawayLines(tx, {
            transactionType: doc.type,
            documentId: header.id,
            items: items.map((item) => ({
              itemId: item.id,
              skuId: item.skuId,
              quantity: doc.pallets,
            })),
          });
          await approveHeader(
            tx,
            doc.type,
            header.id,
            users.approver,
            nameOf(users.approver),
            date,
          );
          // …then the putaway queue racks them, which posts the movement.
          await completePutaway(tx, pool, doc.type, header.id, warehouseId, {
            actorId: users.operator,
            postedById: users.approver,
            putawayModel: doc.type,
          });
        } else if (doc.type === "LOSS") {
          // The loss router posts the write-off on approval. The seed also
          // clears the pallet off the shelf in the same transaction — the
          // plan's own LOSS does the same — so the pallet count and the
          // stock movement stay in step.
          await writeStockMovements(tx, {
            transactionType: "LOSS",
            direction: "OUT",
            documentId: header.id,
            documentNumber: header.documentNumber,
            warehouseId,
            transactionDate: date,
            postedById: users.approver,
            items,
          });
          await consumePallets(tx, pool, {
            documentId: header.id,
            warehouseId,
            skuId,
            quantity: doc.pallets,
            at: date,
            operator: users.operator,
          });
          await approveHeader(
            tx,
            doc.type,
            header.id,
            users.approver,
            nameOf(users.approver),
            date,
          );
        } else {
          // WIP issue / disposal / return to supplier: approval reserves the
          // stock… all three routers call `reservePalletsAndCreatePickLines` in
          // their approve().
          await reservePalletsAndCreatePickLines(tx, DEFAULT_LOCALE, {
            transactionType: doc.type,
            documentId: header.id,
            warehouseId,
            items: [{ skuId, quantity: doc.pallets }],
          });
          await approveHeader(
            tx,
            doc.type,
            header.id,
            users.approver,
            nameOf(users.approver),
            date,
          );
          // …and the dispatch queue closes the pick lines, which clears the
          // slot and posts the outbound movement.
          await completeDispatch(tx, pool, {
            type: doc.type,
            model: doc.type,
            documentId: header.id,
            actorId: users.operator,
            postedById: users.approver,
          });
        }
        await logActivity(tx, {
          action: "APPROVE",
          userId: users.approver,
          resource: info.activity,
          resourceId: header.id,
          message: `Approved ${info.label} ${header.documentNumber}`,
        });
      }, TX_OPTIONS);
    } else {
      // PROPOSED: on the floor, waiting for the supervisor. No reservations and
      // no stock movements — the approval has not run.
      await db.$transaction(async (tx) => {
        await logActivity(tx, {
          action: "UPDATE",
          userId: creator,
          resource: info.activity,
          resourceId: header.id,
          message: `Submitted ${info.label} ${header.documentNumber} for approval`,
        });
      }, TX_OPTIONS);
    }

    enqueue(
      doc.type,
      info,
      header.id,
      header.documentNumber,
      doc.status === "PROPOSED" ? creator : users.approver,
      doc.status === "PROPOSED" ? "PROPOSED" : "APPROVED",
    );
  }

  // ─── 4. Subinventory transfers ─────────────────────────────────────────────
  // A transfer relocates a pallet and nothing else: no reservation, no stock
  // movement, no change to total stock.
  for (const doc of transferDocs) {
    const info = TX_INFO[doc.type];
    const date = eventDate(doc.monthIndex, doc.day);
    const warehouseId = wh(doc.warehouseCode);
    const creator = creatorFor(doc.type, users);
    const header = await createHistoryHeader(
      db,
      doc,
      { wh, sku, supplierOf },
      {
        date,
        warehouseId,
        skuId: sku(doc.skuCode),
        creator,
        pool,
      },
    );
    counts.SUBINVENTORY_TRANSFER++;
    if (doc.status === "DRAFT") continue;

    if (doc.status === "APPROVED") {
      await db.$transaction(async (tx) => {
        // approve(): every pallet moves onto its target slot.
        const items = await tx.subinventoryTransferItem.findMany({
          where: { subinventoryTransferId: header.id },
          select: { palletId: true, fromLocationId: true, toLocationId: true },
        });
        for (const item of items) {
          await tx.pallet.update({
            where: { id: item.palletId },
            data: { storageLocationId: item.toLocationId },
          });
          pool.release(item.fromLocationId);
        }
        await tx.subinventoryTransfer.update({
          where: { id: header.id },
          data: {
            approvalStatus: "APPROVED",
            approvedById: users.approver,
            approvedAt: date,
            approvalHistory: approvalTrail(date),
          },
        });
        await logActivity(tx, {
          action: "APPROVE",
          userId: users.approver,
          resource: info.activity,
          resourceId: header.id,
          message: `Approved ${info.label} ${header.documentNumber}`,
        });
      }, TX_OPTIONS);
    } else {
      await db.$transaction(async (tx) => {
        await logActivity(tx, {
          action: "UPDATE",
          userId: creator,
          resource: info.activity,
          resourceId: header.id,
          message: `Submitted ${info.label} ${header.documentNumber} for approval`,
        });
      }, TX_OPTIONS);
    }
    enqueue(
      doc.type,
      info,
      header.id,
      header.documentNumber,
      doc.status === "PROPOSED" ? creator : users.approver,
      doc.status === "PROPOSED" ? "PROPOSED" : "APPROVED",
    );
  }

  // ─── 5. Cycle counts ───────────────────────────────────────────────────────
  let stockCountCount = 0;
  for (const plan of stockCounts) {
    await db.$transaction(async (tx) => {
      await runStockCount(tx, plan, {
        date: eventDate(plan.monthIndex, plan.day),
        warehouseId: wh(plan.warehouseCode),
        sku,
        nameOf,
        users,
      });
    }, TX_OPTIONS);
    stockCountCount++;
  }

  // ─── 6. Flag a couple of dead slots per warehouse ──────────────────────────
  // Only the storage-location router and the seeded layout import ever set
  // MAINTENANCE, so a seed that never touches it leaves the location list a
  // single flat wall of ACTIVE. A floor with a blocked aisle reads differently,
  // and clearHistory resets the previous run's flags, so this is idempotent.
  const maintenance = await flagMaintenanceLocations(db, wh, users.approver);

  // Notifications fire after their transaction has committed — the interactive
  // client is invalid by then, which is why the routers call this outside their
  // mutation too.
  for (const n of notifications) {
    await notifyApprovalEvent(db, {
      transactionType: n.transactionType,
      resource: n.resource,
      documentId: n.documentId,
      documentNumber: n.documentNumber,
      actionUrl: n.actionUrl,
      actorId: n.actorId,
      actorName: n.actorName,
      status: n.status,
    });
  }

  const result: HistoryCounts = {
    purchaseOrders: purchaseOrders.length,
    receipts: receiptCount,
    wipIssues: counts.WIP_ISSUE,
    wipCompletions: counts.WIP_COMPLETION,
    losses: counts.LOSS,
    founds: counts.FOUND,
    rmaReceipts: counts.RMA_RECEIPT,
    returnsToSupplier: counts.RETURN_TO_SUPPLIER,
    disposals: counts.DISPOSAL,
    transfers: counts.SUBINVENTORY_TRANSFER,
    stockCounts: stockCountCount,
  };
  console.log(
    `   History: ${result.purchaseOrders} purchase orders (${result.receipts} received), ` +
      `${result.wipIssues} WIP issues, ${result.wipCompletions} WIP completions, ` +
      `${result.losses} loss, ${result.founds} found, ` +
      `${result.rmaReceipts} RMA, ${result.returnsToSupplier} returns to supplier, ` +
      `${result.disposals} disposals, ` +
      `${result.transfers} transfers, ${result.stockCounts} stock counts ` +
      `(${reslotted} pallets re-slotted, ${maintenance} slots in maintenance, ` +
      `${notifications.length} notifications)`,
  );
  return result;
}

// ─── document creation ──────────────────────────────────────────────────────

type Resolvers = {
  wh: (code: string) => string;
  sku: (code: string) => string;
  supplierOf: (code: string) => string;
};

const lineFor = (doc: HistoryDoc, skuId: string) => ({
  skuId,
  quantity: cartonsOf(doc.skuCode, doc.pallets),
  details: `${doc.pallets} pallet(s) of ${doc.skuCode}`,
});

/** Creates the document header plus its lines, in the state the domain starts in. */
const createHistoryHeader = async (
  db: DbClient,
  doc: HistoryDoc,
  resolvers: Resolvers,
  params: {
    date: Date;
    warehouseId: string;
    skuId: string;
    creator: string;
    pool?: LocationPool;
  },
) => {
  const info = TX_INFO[doc.type];
  return db.$transaction(async (tx) => {
    const documentNumber = await getNextDocumentNumber(tx, {
      transactionType: doc.type,
      warehouseId: params.warehouseId,
      date: params.date,
    });
    const shared = {
      documentNumber,
      date: params.date,
      reference: documentNumber,
      notes: note(doc.note),
      warehouseId: params.warehouseId,
      createdById: params.creator,
      // A proposed document is raised straight into PROPOSED (the create
      // mutation takes the status as input); an approved one is raised as a
      // DRAFT and walked through the approval step in the caller, the way the
      // app does it.
      approvalStatus: (doc.status === "PROPOSED" ? "PROPOSED" : "DRAFT") as
        "PROPOSED" | "DRAFT",
      approvalHistory:
        doc.status === "PROPOSED" ? approvalTrail(params.date).slice(0, 1) : [],
    };
    const line = lineFor(doc, params.skuId);
    const select = { id: true, documentNumber: true } as const;

    // Each domain adds its own reason field, cross-link and item shape; the
    // create + activity log around them is the same.
    let header: { id: string; documentNumber: string | null };
    if (doc.type === "SUBINVENTORY_TRANSFER") {
      const pool = params.pool;
      if (!pool) throw new Error("history: transfer needs a location pool");
      const pallets = await tx.pallet.findMany({
        where: {
          skuId: params.skuId,
          status: "AVAILABLE",
          storageLocation: { warehouseId: params.warehouseId },
          // A pallet can sit in one transfer document for ever.
          subinventoryTransferItem: null,
        },
        orderBy: { createdAt: "asc" },
        take: doc.pallets,
        select: { id: true, storageLocationId: true },
      });
      if (pallets.length < doc.pallets) {
        throw new Error(
          `history: transfer needs ${doc.pallets} movable pallets of ${doc.skuCode} in ${doc.warehouseCode}, have ${pallets.length}`,
        );
      }
      const targets = await pool.take(params.warehouseId, doc.pallets);
      header = await tx.subinventoryTransfer.create({
        data: {
          ...shared,
          transferReason: doc.reason,
          items: {
            create: pallets.map((pallet, i) => ({
              palletId: pallet.id,
              fromLocationId: pallet.storageLocationId!,
              toLocationId: targets[i]!,
            })),
          },
        },
        select,
      });
    } else if (doc.type === "WIP_ISSUE") {
      header = await tx.wipIssue.create({
        data: {
          ...shared,
          workOrderRef: workOrderRef(doc),
          items: { create: [line] },
        },
        select,
      });
    } else if (doc.type === "WIP_COMPLETION") {
      // Finished goods booked in off the line: the same work-order + batch pair
      // a production operator fills in on the WIP completion form.
      header = await tx.wipCompletion.create({
        data: {
          ...shared,
          workOrderRef: workOrderRef(doc),
          productionBatchNo: productionBatchNo(doc),
          items: { create: [line] },
        },
        select,
      });
    } else if (doc.type === "DISPOSAL") {
      header = await tx.disposal.create({
        data: {
          ...shared,
          disposalReason: doc.reason,
          items: { create: [line] },
        },
        select,
      });
    } else if (doc.type === "LOSS") {
      header = await tx.lossTransaction.create({
        data: { ...shared, lossReason: doc.reason, items: { create: [line] } },
        select,
      });
    } else if (doc.type === "FOUND") {
      header = await tx.foundTransaction.create({
        data: {
          ...shared,
          foundReason: doc.reason,
          foundLocation: "returns staging bay",
          items: { create: [line] },
        },
        select,
      });
    } else if (doc.type === "RETURN_TO_SUPPLIER") {
      // A supplier return points back at the receipt the lot came in on.
      const original = await tx.receivingTransaction.findFirst({
        where: {
          items: { some: { skuId: params.skuId } },
          approvalStatus: "APPROVED",
        },
        orderBy: { date: "desc" },
        select: { id: true },
      });
      header = await tx.returnToSupplier.create({
        data: {
          ...shared,
          supplierId: resolvers.supplierOf(
            SKU_SUPPLIER[doc.skuCode] ?? "SUP-ASSEMBLER",
          ),
          originalReceivingId: original?.id ?? null,
          returnReason: doc.reason,
          items: { create: [line] },
        },
        select,
      });
    } else {
      // A customer return is always booked against the shipment it came back
      // from.
      const original = await tx.shipment.findFirst({
        where: {
          items: { some: { skuId: params.skuId } },
          dispatchStatus: "COMPLETED",
        },
        orderBy: { date: "desc" },
        select: { id: true, salesOrderRef: true },
      });
      header = await tx.rmaReceipt.create({
        data: {
          ...shared,
          originalShipmentId: original?.id ?? null,
          salesOrderRef: original?.salesOrderRef ?? null,
          returnReason: doc.reason,
          items: { create: [line] },
        },
        select,
      });
    }

    await logActivity(tx, {
      action: "CREATE",
      userId: params.creator,
      resource: info.activity,
      resourceId: header.id,
      message: `Created ${info.label} ${documentNumber}`,
    });
    return header;
  }, TX_OPTIONS);
};

const workOrderRef = (doc: HistoryDoc) => {
  const [year] = MONTHS_12[doc.monthIndex]!.split("-");
  return `WO-${year}-${String(doc.monthIndex * 100 + doc.day).padStart(4, "0")}`;
};

/** Traceability lot the goods-in team stamps on a production batch. */
const productionBatchNo = (doc: HistoryDoc) => {
  const [year, month] = MONTHS_12[doc.monthIndex]!.split("-") as [
    string,
    string,
  ];
  return `BATCH-${year.slice(2)}${month}-${doc.skuCode.split("-").pop()}`;
};

const creatorFor = (type: HistoryType, users: HistoryUsers) => {
  if (type === "FOUND" || type === "LOSS") return users.counter;
  if (type === "RETURN_TO_SUPPLIER") return users.picker;
  if (type === "WIP_ISSUE" || type === "SUBINVENTORY_TRANSFER")
    return users.planner;
  return users.operator;
};

/** The DRAFT → APPROVED transition every approve route writes. */
const approveHeader = async (
  tx: Tx,
  type: HistoryType,
  documentId: string,
  approver: string,
  approverName: string,
  at: Date,
) => {
  const { approvalStatus, approvedById, approvedAt } = buildApprovalActionData(
    null,
    { userId: approver, name: approverName },
    "APPROVED",
    "Checked against the paperwork.",
  );
  const data = {
    approvalStatus,
    approvedById: approvedById ?? approver,
    approvedAt: approvedAt ?? at,
    approvalHistory: approvalTrail(at),
  };
  if (type === "WIP_ISSUE") {
    await tx.wipIssue.update({ where: { id: documentId }, data });
    return;
  }
  if (type === "LOSS") {
    await tx.lossTransaction.update({ where: { id: documentId }, data });
    return;
  }
  if (type === "RETURN_TO_SUPPLIER") {
    await tx.returnToSupplier.update({ where: { id: documentId }, data });
    return;
  }
  if (type === "FOUND") {
    await tx.foundTransaction.update({ where: { id: documentId }, data });
    return;
  }
  if (type === "WIP_COMPLETION") {
    await tx.wipCompletion.update({ where: { id: documentId }, data });
    return;
  }
  if (type === "DISPOSAL") {
    await tx.disposal.update({ where: { id: documentId }, data });
    return;
  }
  await tx.rmaReceipt.update({ where: { id: documentId }, data });
};

const readItems = async (
  db: DbClient,
  type: HistoryType,
  documentId: string,
) => {
  const select = {
    items: { select: { id: true, skuId: true, quantity: true } },
  };
  if (type === "WIP_ISSUE") {
    return (
      await db.wipIssue.findUniqueOrThrow({ where: { id: documentId }, select })
    ).items;
  }
  if (type === "LOSS") {
    return (
      await db.lossTransaction.findUniqueOrThrow({
        where: { id: documentId },
        select,
      })
    ).items;
  }
  if (type === "RETURN_TO_SUPPLIER") {
    return (
      await db.returnToSupplier.findUniqueOrThrow({
        where: { id: documentId },
        select,
      })
    ).items;
  }
  if (type === "FOUND") {
    return (
      await db.foundTransaction.findUniqueOrThrow({
        where: { id: documentId },
        select,
      })
    ).items;
  }
  if (type === "WIP_COMPLETION") {
    return (
      await db.wipCompletion.findUniqueOrThrow({
        where: { id: documentId },
        select,
      })
    ).items;
  }
  if (type === "DISPOSAL") {
    return (
      await db.disposal.findUniqueOrThrow({ where: { id: documentId }, select })
    ).items;
  }
  return (
    await db.rmaReceipt.findUniqueOrThrow({ where: { id: documentId }, select })
  ).items;
};

// ─── execution helpers (mirroring routers/transaction.ts) ───────────────────

/**
 * Rack an approved inbound document: assign a free slot to every pending putaway
 * line, close the line, then sync the parent status and post the inbound
 * movement once the document is fully put away — the same sequence as the
 * putaway queue (submitAssignment → syncPutawayStatus).
 */
const completePutaway = async (
  tx: Tx,
  pool: LocationPool,
  type: WarehouseTransactionType,
  documentId: string,
  warehouseId: string,
  params: {
    actorId: string;
    postedById: string;
    putawayModel: "RECEIVING" | "FOUND" | "RMA_RECEIPT" | "WIP_COMPLETION";
  },
) => {
  const lines = await tx.putawayLine.findMany({
    where: { documentId, transactionType: type, status: "PENDING" },
    orderBy: { id: "asc" },
    select: { id: true, palletId: true },
  });
  if (lines.length > 0) {
    const locations = await pool.take(warehouseId, lines.length);
    for (const [index, line] of lines.entries()) {
      await tx.putawayLine.update({
        where: { id: line.id },
        data: {
          storageLocationId: locations[index]!,
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: params.actorId,
        },
      });
      await tx.pallet.update({
        where: { id: line.palletId },
        data: { storageLocationId: locations[index]! },
      });
    }
  }

  const total = await tx.putawayLine.count({
    where: { documentId, transactionType: type },
  });
  const done = await tx.putawayLine.count({
    where: { documentId, transactionType: type, status: "COMPLETED" },
  });
  const status =
    done === 0 ? "PENDING" : done === total ? "COMPLETED" : "PARTIAL";
  if (params.putawayModel === "FOUND") {
    await tx.foundTransaction.update({
      where: { id: documentId },
      data: { putawayStatus: status },
    });
  } else if (params.putawayModel === "RMA_RECEIPT") {
    await tx.rmaReceipt.update({
      where: { id: documentId },
      data: { putawayStatus: status },
    });
  } else if (params.putawayModel === "WIP_COMPLETION") {
    await tx.wipCompletion.update({
      where: { id: documentId },
      data: { putawayStatus: status },
    });
  } else {
    await tx.receivingTransaction.update({
      where: { id: documentId },
      data: { putawayStatus: status },
    });
  }
  if (status === "COMPLETED") {
    await writeStockMovementsFromDocument(
      tx,
      type,
      documentId,
      "IN",
      params.postedById,
    );
  }
};

/**
 * Close every pick line of an approved outbound document: the pallet leaves the
 * slot, the line is completed, and the outbound movement is posted once the
 * document is fully dispatched — dispatch.complete → syncDispatchStatus.
 */
const completeDispatch = async (
  tx: Tx,
  pool: LocationPool,
  params: {
    type: WarehouseTransactionType;
    model: HistoryType;
    documentId: string;
    actorId: string;
    postedById: string;
  },
) => {
  const lines = await tx.pickLine.findMany({
    where: {
      documentId: params.documentId,
      transactionType: params.type,
      status: "PENDING",
    },
    select: { id: true, palletId: true, fromLocationId: true },
  });
  for (const line of lines) {
    await tx.pallet.update({
      where: { id: line.palletId },
      data: { status: "NOT_AVAILABLE", storageLocationId: null },
    });
    await tx.pickLine.update({
      where: { id: line.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: params.actorId,
      },
    });
    if (line.fromLocationId) pool.release(line.fromLocationId);
  }

  const total = await tx.pickLine.count({
    where: { documentId: params.documentId, transactionType: params.type },
  });
  const done = await tx.pickLine.count({
    where: {
      documentId: params.documentId,
      transactionType: params.type,
      status: "COMPLETED",
    },
  });
  const status =
    done === 0 ? "PENDING" : done === total ? "COMPLETED" : "PARTIAL";
  if (params.model === "WIP_ISSUE") {
    await tx.wipIssue.update({
      where: { id: params.documentId },
      data: { dispatchStatus: status },
    });
  } else if (params.model === "DISPOSAL") {
    await tx.disposal.update({
      where: { id: params.documentId },
      data: { dispatchStatus: status },
    });
  } else {
    await tx.returnToSupplier.update({
      where: { id: params.documentId },
      data: { dispatchStatus: status },
    });
  }
  if (status === "COMPLETED") {
    await writeStockMovementsFromDocument(
      tx,
      params.type,
      params.documentId,
      "OUT",
      params.postedById,
    );
  }
};

/**
 * A written-off pallet leaves the shelf: one closed pick line per pallet in the
 * same transaction that posts the write-off, mirroring the plan's own LOSS.
 */
const consumePallets = async (
  tx: Tx,
  pool: LocationPool,
  params: {
    documentId: string;
    warehouseId: string;
    skuId: string;
    quantity: number;
    at: Date;
    operator: string;
  },
) => {
  const pallets = await tx.pallet.findMany({
    where: {
      skuId: params.skuId,
      status: "AVAILABLE",
      storageLocation: { warehouseId: params.warehouseId },
    },
    orderBy: { createdAt: "asc" },
    take: params.quantity,
    select: { id: true, storageLocationId: true },
  });
  if (pallets.length < params.quantity) {
    throw new Error(
      `history: loss needs ${params.quantity} pallets of ${params.skuId} in ${params.warehouseId}, have ${pallets.length}`,
    );
  }
  for (const pallet of pallets) {
    await tx.pickLine.create({
      data: {
        transactionType: "LOSS",
        documentId: params.documentId,
        palletId: pallet.id,
        fromLocationId: pallet.storageLocationId,
        status: "COMPLETED",
        assignedAt: params.at,
        assignedById: params.operator,
        completedAt: params.at,
        completedById: params.operator,
      },
    });
    await tx.pallet.update({
      where: { id: pallet.id },
      data: { status: "NOT_AVAILABLE", storageLocationId: null },
    });
    if (pallet.storageLocationId) pool.release(pallet.storageLocationId);
  }
};

// ─── cycle counts ───────────────────────────────────────────────────────────

/**
 * One zone count: snapshot the available pallets of the counted SKUs, enter the
 * counter's tally, and on sign-off turn the variances into DRAFT loss/found
 * adjustments carrying a STOCK_COUNT source link — the two documents the
 * counting app writes (`routers/stock-count.ts` create → saveCounts → approve).
 */
const runStockCount = async (
  tx: Tx,
  plan: (typeof STOCK_COUNTS)[number],
  params: {
    date: Date;
    warehouseId: string;
    sku: (code: string) => string;
    nameOf: (userId: string) => string;
    users: HistoryUsers;
  },
) => {
  const { date, warehouseId, sku, users } = params;
  const approvedAt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const documentNumber = await getNextDocumentNumberByCode(tx, {
    code: "CNT",
    model: "stockCount",
    warehouseId,
    date,
  });
  const count = await tx.stockCount.create({
    data: {
      documentNumber,
      date,
      warehouseId,
      isBlindCount: plan.isBlindCount,
      notes: note(plan.note),
      createdById: users.counter,
      status: "IN_PROGRESS",
    },
    select: { id: true, documentNumber: true },
  });

  const pallets = await tx.pallet.findMany({
    where: {
      status: "AVAILABLE",
      storageLocation: { warehouseId },
      skuId: { in: plan.skuCodes.map((code) => sku(code)) },
    },
    orderBy: { id: "asc" },
    select: { id: true, skuId: true, storageLocationId: true },
  });
  if (pallets.length === 0) {
    throw new Error(
      `history: stock count ${documentNumber} has no pallets in scope`,
    );
  }
  await tx.stockCountLine.createMany({
    data: pallets.map((pallet) => ({
      stockCountId: count.id,
      skuId: pallet.skuId,
      palletId: pallet.id,
      storageLocationId: pallet.storageLocationId,
      systemQty: 1,
    })),
  });

  // The tally. A shortage row (the slot is empty) and a surplus row (an
  // unexpected pallet) are the variances; on an open count only the first SKU's
  // aisle has been walked, so its lines stay blank.
  const shortageId = plan.shortageSkuCode ? sku(plan.shortageSkuCode) : null;
  const surplusId = plan.surplusSkuCode ? sku(plan.surplusSkuCode) : null;
  const inScope =
    plan.status === "COMPLETED"
      ? pallets
      : pallets.filter((pallet) => pallet.skuId === plan.skuCodes[0]);
  const shortagePallet = inScope.find((p) => p.skuId === shortageId)?.id;
  const surplusPallet = inScope.find((p) => p.skuId === surplusId)?.id;
  const tally = new Map<string, number>();
  for (const pallet of inScope) {
    tally.set(
      pallet.id,
      pallet.id === shortagePallet ? 0 : pallet.id === surplusPallet ? 2 : 1,
    );
  }

  const lines = await tx.stockCountLine.findMany({
    where: { stockCountId: count.id },
    orderBy: { id: "asc" },
    select: { id: true, palletId: true },
  });
  const countedAt = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  for (const line of lines) {
    const countedQty = line.palletId ? tally.get(line.palletId) : undefined;
    if (countedQty === undefined) continue;
    await tx.stockCountLine.update({
      where: { id: line.id },
      data: { countedQty, variance: countedQty - 1, countedAt },
    });
  }
  await tx.stockCount.update({
    where: { id: count.id },
    data: { countedById: users.counter },
  });
  await logActivity(tx, {
    action: "CREATE",
    userId: users.counter,
    resource: "stock_count",
    resourceId: count.id,
    message: `Created stock count ${documentNumber} with ${lines.length} lines`,
    detail: { lineCount: lines.length },
  });

  if (plan.status === "IN_PROGRESS") return;

  const shortages = lines.filter(
    (l) => l.palletId && tally.get(l.palletId) === 0,
  );
  const surpluses = lines.filter(
    (l) => l.palletId && tally.get(l.palletId) === 2,
  );
  const adjustmentHistory = [
    {
      process: "GENERATED",
      userName: params.nameOf(users.counter),
      timeframe: date.toISOString(),
      message: `Generated from stock count ${count.documentNumber}`,
    },
  ];
  const shared = {
    date,
    reference: count.documentNumber,
    notes: note(`Auto-generated from stock count ${count.documentNumber}.`),
    warehouseId,
    createdById: users.counter,
    sourceType: "STOCK_COUNT",
    sourceId: count.id,
    approvalHistory: adjustmentHistory,
  };

  if (shortages.length > 0) {
    const lossNumber = await getNextDocumentNumberByCode(tx, {
      code: "LOS",
      model: "lossTransaction",
      warehouseId,
      date,
    });
    await tx.lossTransaction.create({
      data: {
        ...shared,
        documentNumber: lossNumber,
        lossReason: "Cycle count variance",
        items: {
          create: shortages.map(() => ({
            skuId: shortageId!,
            quantity: 1,
            details: "Count variance",
          })),
        },
      },
    });
  }
  if (surpluses.length > 0) {
    const foundNumber = await getNextDocumentNumberByCode(tx, {
      code: "FND",
      model: "foundTransaction",
      warehouseId,
      date,
    });
    await tx.foundTransaction.create({
      data: {
        ...shared,
        documentNumber: foundNumber,
        foundReason: "Cycle count variance",
        items: {
          create: surpluses.map(() => ({
            skuId: surplusId!,
            quantity: 1,
            details: "Count surplus",
          })),
        },
      },
    });
  }

  await tx.stockCount.update({
    where: { id: count.id },
    data: {
      status: "COMPLETED",
      approvedById: users.approver,
      approvedAt,
      approvalHistory: [
        {
          process: "APPROVED",
          userName: params.nameOf(users.approver),
          timeframe: approvedAt.toISOString(),
          message: "Count sheet signed off.",
        },
      ],
    },
  });
  await logActivity(tx, {
    action: "APPROVE",
    userId: users.approver,
    resource: "stock_count",
    resourceId: count.id,
    message: `Approved stock count ${documentNumber}`,
  });
};

// ─── warehouse layout ───────────────────────────────────────────────────────

const reslotOccupiedLocations = async (
  db: DbClient,
  wh: (code: string) => string,
) => {
  let moved = 0;
  for (const code of ["WH01", "WH02", "WH03"]) {
    const warehouseId = wh(code);
    const occupied = await db.pallet.findMany({
      where: { status: "AVAILABLE", storageLocation: { warehouseId } },
      orderBy: { storageLocationId: "desc" },
      select: { id: true, storageLocationId: true },
    });
    const free = await db.storageLocation.findMany({
      where: {
        warehouseId,
        status: "ACTIVE",
        pallet: null,
        id: { in: occupied.map((p) => p.storageLocationId ?? "") },
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (free.length === 0) continue;
    for (const pallet of occupied) {
      const target = free.shift();
      if (!target || !pallet.storageLocationId) break;
      if (target.id === pallet.storageLocationId) continue;
      await db.pallet.update({
        where: { id: pallet.id },
        data: { storageLocationId: target.id },
      });
      moved++;
    }
  }
  return moved;
};

/**
 * Marker in the activity log that identifies the storage locations THIS step
 * took out of service. The log row is the durable record of which slots were
 * flagged, which is what makes `clearMaintenanceFlags` able to reset exactly
 * those — a blanket `status != ACTIVE` reset would also clear a slot a user
 * blocked through the storage-location router, i.e. their own master data.
 */
const MAINTENANCE_MARKER = "(aisle repair)";

/**
 * Puts the storage locations this step flagged back to ACTIVE and drops the
 * marker rows, so a re-run re-picks the same slots deterministically.
 *
 * Called both by `clearHistory` (standalone re-run) and by `runSeed`'s
 * domain reset (full re-seed), because the full reset deletes the marker rows
 * — leaving the flags behind would accumulate two more dead slots per
 * warehouse on every re-seed.
 *
 * Exported so `seed/index.ts` can clear the flags BEFORE it deletes the
 * activity log rows that identify them.
 */
export const clearMaintenanceFlags = async (db: DbClient): Promise<number> => {
  const where = {
    resource: "storage_location",
    message: { contains: MAINTENANCE_MARKER },
  };
  const flagged = await db.activityLog.findMany({
    where,
    select: { resourceId: true },
  });
  const ids = [...new Set(flagged.map((row) => row.resourceId))];
  if (ids.length === 0) return 0;
  await db.$transaction([
    db.storageLocation.updateMany({
      where: { id: { in: ids }, status: "MAINTENANCE" },
      data: { status: "ACTIVE" },
    }),
    db.activityLog.deleteMany({ where }),
  ]);
  return ids.length;
};

const flagMaintenanceLocations = async (
  db: DbClient,
  wh: (code: string) => string,
  actorId: string,
) => {
  let flagged = 0;
  for (const code of ["WH01", "WH02", "WH03"]) {
    const warehouseId = wh(code);
    const free = await db.storageLocation.findMany({
      where: { warehouseId, status: "ACTIVE", pallet: null },
      orderBy: { id: "desc" },
      take: MAINTENANCE_PER_WAREHOUSE,
      select: { id: true },
    });
    for (const location of free) {
      await db.storageLocation.update({
        where: { id: location.id },
        data: { status: "MAINTENANCE" },
      });
      await logActivity(db, {
        action: "UPDATE",
        userId: actorId,
        resource: "storage_location",
        resourceId: location.id,
        message: `Storage location ${location.id} taken out of service ${MAINTENANCE_MARKER}`,
      });
      flagged++;
    }
  }
  return flagged;
};

// ─── idempotency ────────────────────────────────────────────────────────────

/**
 * Removes everything a previous run of this step wrote, so a standalone re-run
 * replaces the history instead of doubling it:
 *   - documents matched on the note prefix, plus the DRAFT loss/found rows the
 *     stock counts generated (matched on their soft source link)
 *   - the purchase orders those goods receipts pointed at
 *   - the pallets the step received (its own creations), the stock it consumed
 *     (released back to the slot it came from) and the slots it moved
 *   - the location flags it set, so the next run re-picks them deterministically
 *
 * A full `runSeed` already cleared these tables in `resetWarehouseDomain`, so
 * this is a no-op there.
 */
async function clearHistory(db: DbClient): Promise<void> {
  const startsWith = HISTORY_NOTE_PREFIX;
  const flagged = (rows: Array<{ id: string; notes: string | null }>) =>
    rows.filter((r) => r.notes?.startsWith(startsWith)).map((r) => r.id);

  const [
    receiving,
    wipIssues,
    wipCompletions,
    rma,
    rts,
    transfers,
    losses,
    founds,
    disposals,
    counts,
    orders,
  ] = await Promise.all([
    db.receivingTransaction.findMany({ select: { id: true, notes: true } }),
    db.wipIssue.findMany({ select: { id: true, notes: true } }),
    db.wipCompletion.findMany({ select: { id: true, notes: true } }),
    db.rmaReceipt.findMany({ select: { id: true, notes: true } }),
    db.returnToSupplier.findMany({ select: { id: true, notes: true } }),
    db.subinventoryTransfer.findMany({ select: { id: true, notes: true } }),
    db.lossTransaction.findMany({
      select: { id: true, notes: true, sourceId: true },
    }),
    db.foundTransaction.findMany({
      select: { id: true, notes: true, sourceId: true },
    }),
    db.disposal.findMany({ select: { id: true, notes: true } }),
    db.stockCount.findMany({ select: { id: true, notes: true } }),
    db.purchaseOrder.findMany({ select: { id: true, notes: true } }),
  ]);

  const countIds = flagged(counts);
  // A count's adjustments carry only a soft link back to the sheet, so match
  // those too or they outlive the count they came from.
  const fromCount = (rows: Array<{ id: string; sourceId: string | null }>) =>
    rows
      .filter((r) => r.sourceId && countIds.includes(r.sourceId))
      .map((r) => r.id);

  const docIds = [
    ...flagged(receiving),
    ...flagged(wipIssues),
    ...flagged(wipCompletions),
    ...flagged(rma),
    ...flagged(rts),
    ...flagged(transfers),
    ...flagged(losses),
    ...flagged(founds),
    ...flagged(disposals),
    ...fromCount(losses),
    ...fromCount(founds),
    ...countIds,
    ...flagged(orders),
  ];
  // Before the early return: the location flags are this step's, whether or
  // not any document survived from a previous run. Scoped to the slots this
  // step actually flagged (see clearMaintenanceFlags) — resetting every
  // non-ACTIVE location in the database would also un-block slots a user took
  // out of service through the storage-location router.
  await clearMaintenanceFlags(db);
  if (docIds.length === 0) return;

  // Pallets the step RECEIVED are its own creations.
  const received = await db.pallet.findMany({
    where: { putawayLine: { documentId: { in: docIds } } },
    select: { id: true },
  });
  const receivedIds = new Set(received.map((p) => p.id));
  // Pallets it consumed are pre-existing stock it flipped to NOT_AVAILABLE, and
  // a transfer only moved a pallet — both go back on the shelf. Pallets the
  // step received itself are dropped with their documents, never restored.
  const preExisting = <
    T extends { palletId: string; fromLocationId: string | null },
  >(
    rows: T[],
  ) => rows.filter((row) => !receivedIds.has(row.palletId));
  const consumed = preExisting(
    await db.pickLine.findMany({
      where: { documentId: { in: docIds } },
      select: { palletId: true, fromLocationId: true },
    }),
  );
  const moved = preExisting(
    await db.subinventoryTransferItem.findMany({
      where: { subinventoryTransferId: { in: docIds } },
      select: { palletId: true, fromLocationId: true },
    }),
  );

  await db.$transaction([
    db.notification.deleteMany({ where: { targetId: { in: docIds } } }),
    // Stock movements are the immutable audit log, so nothing in the app ever
    // deletes one — this step's own movements have to go with its documents or
    // a re-run doubles the ledger.
    db.stockMovement.deleteMany({ where: { documentId: { in: docIds } } }),
    db.stockCountLine.deleteMany({ where: { stockCountId: { in: countIds } } }),
    db.stockCount.deleteMany({ where: { id: { in: countIds } } }),
    db.putawayLine.deleteMany({ where: { documentId: { in: docIds } } }),
    db.pickLine.deleteMany({ where: { documentId: { in: docIds } } }),
    db.subinventoryTransferItem.deleteMany({
      where: { subinventoryTransferId: { in: docIds } },
    }),
    db.pallet.deleteMany({ where: { id: { in: received.map((p) => p.id) } } }),
    db.activityLog.deleteMany({ where: { resourceId: { in: docIds } } }),
    db.receivingTransaction.deleteMany({
      where: { id: { in: flagged(receiving) } },
    }),
    db.wipIssue.deleteMany({ where: { id: { in: flagged(wipIssues) } } }),
    db.wipCompletion.deleteMany({
      where: { id: { in: flagged(wipCompletions) } },
    }),
    db.rmaReceipt.deleteMany({ where: { id: { in: flagged(rma) } } }),
    db.returnToSupplier.deleteMany({ where: { id: { in: flagged(rts) } } }),
    db.subinventoryTransfer.deleteMany({
      where: { id: { in: flagged(transfers) } },
    }),
    db.lossTransaction.deleteMany({ where: { id: { in: flagged(losses) } } }),
    db.lossTransaction.deleteMany({ where: { id: { in: fromCount(losses) } } }),
    db.foundTransaction.deleteMany({ where: { id: { in: flagged(founds) } } }),
    db.foundTransaction.deleteMany({
      where: { id: { in: fromCount(founds) } },
    }),
    db.disposal.deleteMany({ where: { id: { in: flagged(disposals) } } }),
    db.purchaseOrder.deleteMany({ where: { id: { in: flagged(orders) } } }),
  ]);

  await restorePallets(db, [...moved, ...consumed]);
}

/**
 * Hands back the slots the step took, in the order that frees them: a transfer's
 * pallet is still sitting on its target slot, so moving it home releases that
 * slot for the consumed stock that was picked from it. A slot that is claimed
 * anyway falls back to the lowest free slot in the pallet's warehouse, so a
 * re-run never leaves stock without one.
 */
async function restorePallets(
  db: DbClient,
  lines: Array<{ palletId: string; fromLocationId: string | null }>,
): Promise<void> {
  for (const line of lines) {
    const target = line.fromLocationId;
    if (target) {
      const occupant = await db.pallet.findFirst({
        where: { storageLocationId: target },
        select: { id: true },
      });
      if (!occupant) {
        await db.pallet.update({
          where: { id: line.palletId },
          data: { status: "AVAILABLE", storageLocationId: target },
        });
        continue;
      }
      // Still claimed: fall back to the lowest free slot in the same warehouse.
      const source = await db.storageLocation.findUnique({
        where: { id: target },
        select: { warehouseId: true },
      });
      const fallback = source
        ? await db.storageLocation.findFirst({
            where: {
              warehouseId: source.warehouseId,
              status: "ACTIVE",
              pallet: null,
            },
            orderBy: { id: "asc" },
            select: { id: true },
          })
        : null;
      await db.pallet.update({
        where: { id: line.palletId },
        data: { status: "AVAILABLE", storageLocationId: fallback?.id ?? null },
      });
      continue;
    }
    await db.pallet.update({
      where: { id: line.palletId },
      data: { status: "AVAILABLE" },
    });
  }
}
