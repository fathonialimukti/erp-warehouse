import type { DbClient } from "../../../lib/prisma.js";
import { getNextDocumentNumber } from "../../../lib/document-number.js";
import {
  createPalletsAndPutawayLines,
  reservePalletsAndCreatePickLines,
} from "../../../lib/transaction.js";
import { notifyApprovalEvent } from "../../../lib/approval-notify.js";
import { DEFAULT_LOCALE } from "../../../lib/locale.js";
import { isoContainerId } from "../lib/iso6346.js";
import { CARRIERS, DISTRIBUTORS, SKU_SUPPLIER } from "../catalog/partners.js";
import type { MasterIds } from "./02-master.js";

/**
 * Marks the documents this step owns. Doubles as the idempotency key: the note
 * reads naturally in the UI and its `startsWith` match lets a re-run replace
 * the open queue instead of doubling it.
 */
const OPEN_NOTE_PREFIX = "Open item —";

/** The permission resource prefix `notifyApprovalEvent` fans out on. */
const RESOURCE_BY_TYPE = {
  RECEIVING: "receiving",
  WIP_COMPLETION: "wip-completion",
  SHIPMENT: "shipment",
  DISPOSAL: "disposal",
} as const;

/** Client route prefix for the document's detail page. */
const ROUTE_BY_TYPE = {
  RECEIVING: "/inbound-transaction/receiving",
  WIP_COMPLETION: "/inbound-transaction/wip-completion",
  SHIPMENT: "/outbound-transaction/shipment",
  DISPOSAL: "/outbound-transaction/disposal",
} as const;

/**
 * A working warehouse always has work in flight. The historical plan in
 * `03-schedule.ts` deliberately drains every document it creates (all APPROVED,
 * all putaway/dispatch COMPLETED), so a plain seed left Pending Approvals,
 * Putaway Queue and Dispatch Queue reading 0 — which reads as "this app is
 * empty" rather than "nothing needs attention right now".
 *
 * This step leaves a small, plausible set of open work:
 *   - 5 PROPOSED documents waiting on the supervisor across 3 domains
 *     (receiving, WIP completion, shipment, disposal) → Pending Approvals
 *   - 1 approved RECEIVING with PENDING putaway lines → Putaway Queue
 *   - 1 approved SHIPMENT with PENDING pick lines   → Dispatch Queue
 *
 * Rows are written through the same `lib/transaction.ts` helpers the routers
 * call on approval, so the open queue is indistinguishable from real app output.
 * Nothing here posts a stock movement: unapproved work has not hit inventory.
 */
export async function runOpenQueue(
  db: DbClient,
  ids: MasterIds,
  ctx: { approver: string; operator: string; picker: string },
): Promise<void> {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const note = (text: string) => `${OPEN_NOTE_PREFIX} ${text}`;

  await clearOpenQueue(db);

  const wh = (code: string) => {
    const id = ids.warehouse[code];
    if (!id) throw new Error(`open-queue: warehouse ${code} not seeded`);
    return id;
  };
  const sku = (code: string) => {
    const id = ids.sku[code];
    if (!id) throw new Error(`open-queue: sku ${code} not seeded`);
    return id;
  };
  const supplierFor = (skuCode: string) => {
    const code = SKU_SUPPLIER[skuCode];
    const id = code ? ids.supplier[code] : undefined;
    if (!id) {
      throw new Error(`open-queue: supplier for ${skuCode} not seeded`);
    }
    return id;
  };

  // ─── Pending approvals ────────────────────────────────────────────────────
  // Awaiting supervisor sign-off. No pallets, no stock movements: the approval
  // handlers create those, and they have not run.

  const proposed: Array<{
    type: "RECEIVING" | "WIP_COMPLETION" | "SHIPMENT" | "DISPOSAL";
    warehouseCode: string;
    note: string;
    items: Array<{ skuCode: string; quantity: number }>;
  }> = [
    {
      type: "RECEIVING",
      warehouseCode: "WH01",
      note: "PCBA replenishment awaiting supervisor approval.",
      items: [
        { skuCode: "RAW-PCB", quantity: 4 },
        { skuCode: "RAW-PCM", quantity: 2 },
      ],
    },
    {
      type: "RECEIVING",
      warehouseCode: "WH01",
      note: "Bulk granulate top-up awaiting supervisor approval.",
      items: [{ skuCode: "RAW-GRANU", quantity: 2 }],
    },
    {
      type: "WIP_COMPLETION",
      warehouseCode: "WH02",
      note: "Line B finished batch awaiting supervisor approval.",
      items: [
        { skuCode: "FG-SPRK-MINI", quantity: 3 },
        { skuCode: "FG-HUB-HOME", quantity: 2 },
      ],
    },
    {
      type: "SHIPMENT",
      warehouseCode: "WH03",
      note: "Distributor order awaiting supervisor approval.",
      items: [{ skuCode: "FG-EARB-AIR", quantity: 2 }],
    },
    {
      type: "DISPOSAL",
      warehouseCode: "WH01",
      note: "Water-damaged housings written off pending QC sign-off.",
      items: [{ skuCode: "RAW-PLASTIC", quantity: 1 }],
    },
  ];

  for (const [index, doc] of proposed.entries()) {
    const warehouseId = wh(doc.warehouseCode);
    const containerId = isoContainerId("MSCU", 700000 + index);
    const carrier = CARRIERS[index % CARRIERS.length]!.name;
    let createdId = "";
    let createdNumber: string | null = null;

    await db.$transaction(
      async (tx) => {
        const documentNumber = await getNextDocumentNumber(tx, {
          transactionType: doc.type,
          warehouseId,
          date: today,
        });
        createdId = "";
        createdNumber = documentNumber;

        if (doc.type === "RECEIVING") {
          const header = await tx.receivingTransaction.create({
            data: {
              documentNumber,
              date: today,
              supplierId: supplierFor(doc.items[0]!.skuCode),
              purchaseOrderRef: `PO-${containerId}`,
              deliveryNoteRef: `DN/${doc.warehouseCode}/${String(
                9000 + index,
              ).padStart(4, "0")}`,
              carrier,
              trackingNumber: containerId,
              driverName: "Prins Logistics",
              driverContact: "+31-6-5550-0199",
              vehiclePlate: "NL-909-ZZ",
              notes: note(doc.note),
              warehouseId,
              createdById: ctx.operator,
              approvalStatus: "PROPOSED",
              putawayStatus: "PENDING",
            },
            select: { id: true },
          });
          createdId = header.id;
          for (const [i, item] of doc.items.entries()) {
            await tx.receivingTransactionItem.create({
              data: {
                receivingTransactionId: header.id,
                sortOrder: i,
                skuId: sku(item.skuCode),
                quantity: item.quantity,
                details: `${item.quantity} pallet(s) of ${item.skuCode}`,
              },
            });
          }
          return;
        }

        if (doc.type === "WIP_COMPLETION") {
          const header = await tx.wipCompletion.create({
            data: {
              documentNumber,
              date: today,
              workOrderRef: "WO-2026-0918",
              productionBatchNo: "BATCH-2609-B",
              notes: note(doc.note),
              warehouseId,
              createdById: ctx.operator,
              approvalStatus: "PROPOSED",
              putawayStatus: "PENDING",
            },
            select: { id: true },
          });
          createdId = header.id;
          for (const [i, item] of doc.items.entries()) {
            await tx.wipCompletionItem.create({
              data: {
                wipCompletionId: header.id,
                sortOrder: i,
                skuId: sku(item.skuCode),
                quantity: item.quantity,
                details: `${item.quantity} pallet(s) of ${item.skuCode}`,
              },
            });
          }
          return;
        }

        if (doc.type === "SHIPMENT") {
          const header = await tx.shipment.create({
            data: {
              documentNumber,
              date: today,
              shipmentNumber: documentNumber,
              salesOrderRef: `SO-${containerId}`,
              recipient: DISTRIBUTORS[index % DISTRIBUTORS.length]!.name,
              reference: documentNumber,
              notes: note(doc.note),
              carrier,
              trackingNumber: containerId,
              warehouseId,
              createdById: ctx.picker,
              approvalStatus: "PROPOSED",
              dispatchStatus: "PENDING",
            },
            select: { id: true },
          });
          createdId = header.id;
          for (const item of doc.items) {
            await tx.shipmentItem.create({
              data: {
                shipmentId: header.id,
                skuId: sku(item.skuCode),
                quantity: item.quantity,
                details: `${item.quantity} pallet(s) of ${item.skuCode}`,
              },
            });
          }
          return;
        }

        const header = await tx.disposal.create({
          data: {
            documentNumber,
            date: today,
            disposalReason: "Water damage in rack aisle 7",
            notes: note(doc.note),
            warehouseId,
            createdById: ctx.operator,
            approvalStatus: "PROPOSED",
            dispatchStatus: "PENDING",
          },
          select: { id: true },
        });
        createdId = header.id;
        for (const item of doc.items) {
          await tx.disposalItem.create({
            data: {
              disposalId: header.id,
              skuId: sku(item.skuCode),
              quantity: item.quantity,
              details: `${item.quantity} pallet(s) of ${item.skuCode}`,
            },
          });
        }
      },
      { timeout: 30_000, maxWait: 15_000 },
    );

    // Same notifier the routers call, so the supervisor's bell matches the
    // Pending Approvals KPI instead of showing an empty inbox next to a
    // non-zero counter. Fired on the outer client: the interactive client is
    // invalid once the transaction commits.
    await notifyApprovalEvent(db, {
      transactionType: doc.type,
      resource: RESOURCE_BY_TYPE[doc.type],
      documentId: createdId,
      documentNumber: createdNumber,
      actionUrl: `${ROUTE_BY_TYPE[doc.type]}/${createdId}`,
      actorId: doc.type === "SHIPMENT" ? ctx.picker : ctx.operator,
      actorName: doc.type === "SHIPMENT" ? "Outbound Staff" : "Inbound Staff",
      status: "PROPOSED",
    });
  }

  // ─── Putaway queue ───────────────────────────────────────────────────────
  // Goods received and approved; pallets created but not yet racked. Uses the
  // same helper the receiving router's approve() calls.

  const putawayDoc = {
    warehouseCode: "WH01",
    skuCodes: ["RAW-PCB", "RAW-PCM", "RAW-PCB", "RAW-CARTON"] as const,
    note: "Approved inbound — 4 pallets waiting to be racked.",
  };
  const wh01 = wh(putawayDoc.warehouseCode);
  await db.$transaction(
    async (tx) => {
      const documentNumber = await getNextDocumentNumber(tx, {
        transactionType: "RECEIVING",
        warehouseId: wh01,
        date: today,
      });
      const header = await tx.receivingTransaction.create({
        data: {
          documentNumber,
          date: today,
          supplierId: supplierFor("RAW-PCB"),
          purchaseOrderRef: "PO-MSCU-704118",
          deliveryNoteRef: "DN/WH01/0918",
          carrier: "Maasvlakte Trucking",
          driverName: "Marco Rossi",
          driverContact: "+31-6-5550-0104",
          vehiclePlate: "NL-404-DD",
          notes: note(putawayDoc.note),
          warehouseId: wh01,
          createdById: ctx.operator,
          approvedById: ctx.approver,
          approvedAt: new Date(today.getTime() + 90 * 60 * 1000),
          approvalStatus: "APPROVED",
          putawayStatus: "PENDING",
          approvalHistory: [
            {
              action: "APPROVED",
              by: ctx.approver,
              at: new Date(today.getTime() + 90 * 60 * 1000).toISOString(),
            },
          ],
        },
        select: { id: true },
      });

      const bySku = new Map<string, number>();
      for (const code of putawayDoc.skuCodes) {
        bySku.set(code, (bySku.get(code) ?? 0) + 1);
      }

      const items = [];
      for (const [code, count] of bySku) {
        const item = await tx.receivingTransactionItem.create({
          data: {
            receivingTransactionId: header.id,
            skuId: sku(code),
            quantity: count,
            details: `${count} pallet(s) of ${code}`,
          },
          select: { id: true },
        });
        items.push({ itemId: item.id, skuId: sku(code), quantity: count });
      }

      await createPalletsAndPutawayLines(tx, {
        transactionType: "RECEIVING",
        documentId: header.id,
        items,
      });
    },
    { timeout: 30_000, maxWait: 15_000 },
  );

  // ─── Dispatch queue ──────────────────────────────────────────────────────
  // Order approved and picked stock reserved, not yet dispatched. Uses the same
  // helper the shipment router's approve() calls.
  //
  // The SKUs come from actual stock rather than a hardcoded list: the plan in
  // `03-schedule.ts` drains whatever it received, so on a full 12-month run a
  // named SKU can be down to zero and `reservePalletsAndCreatePickLines`
  // would throw and take the whole seed with it.

  const wh03 = wh("WH03");
  const inStock = await db.pallet.groupBy({
    by: ["skuId"],
    where: {
      status: "AVAILABLE",
      storageLocation: { warehouseId: wh03 },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 2,
  });
  const dispatchItems = inStock.flatMap(({ skuId, _count }) => {
    const quantity = Math.min(_count.id, 2);
    const code = Object.entries(ids.sku).find(([, id]) => id === skuId)?.[0];
    return code ? [{ skuCode: code, quantity }] : [];
  });

  if (dispatchItems.length === 0) {
    // Nothing on hand to pick. Leave the dispatch queue empty rather than fail
    // the seed — a warehouse with zero free pallets is a legitimate state.
    console.warn(
      "   Open queue: WH03 has no AVAILABLE pallets — dispatch queue left empty",
    );
    return;
  }

  const palletCount = dispatchItems.reduce((sum, i) => sum + i.quantity, 0);
  await db.$transaction(
    async (tx) => {
      const documentNumber = await getNextDocumentNumber(tx, {
        transactionType: "SHIPMENT",
        warehouseId: wh03,
        date: today,
      });
      const approvedAt = new Date(today.getTime() + 75 * 60 * 1000);
      const header = await tx.shipment.create({
        data: {
          documentNumber,
          date: today,
          shipmentNumber: documentNumber,
          salesOrderRef: "SO-2026-4471",
          recipient: DISTRIBUTORS[1]!.name,
          reference: documentNumber,
          notes: note(
            `Approved order — ${palletCount} pallet(s) picked, waiting for the truck.`,
          ),
          carrier: "Prins Logistics",
          trackingNumber: isoContainerId("HLXU", 700100),
          warehouseId: wh03,
          createdById: ctx.picker,
          approvedById: ctx.approver,
          approvedAt,
          approvalStatus: "APPROVED",
          dispatchStatus: "PENDING",
          dispatchOpenStatus: "OPEN",
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

      const reserved = [];
      for (const item of dispatchItems) {
        const skuId = sku(item.skuCode);
        await tx.shipmentItem.create({
          data: {
            shipmentId: header.id,
            skuId,
            quantity: item.quantity,
            details: `${item.quantity} pallet(s) of ${item.skuCode}`,
          },
        });
        reserved.push({ skuId, quantity: item.quantity });
      }

      await reservePalletsAndCreatePickLines(tx, DEFAULT_LOCALE, {
        transactionType: "SHIPMENT",
        documentId: header.id,
        warehouseId: wh03,
        items: reserved,
      });
    },
    { timeout: 30_000, maxWait: 15_000 },
  );
}

/**
 * Removes the documents a previous run of this step created, restores the
 * stock its dispatch doc had reserved, and drops the pallets it received. So a
 * standalone re-run replaces the queue instead of doubling it — and leaves
 * inventory exactly as it found it. A full `runSeed` already cleared these
 * tables in `resetWarehouseDomain`, making this a no-op there.
 */
async function clearOpenQueue(db: DbClient): Promise<void> {
  const flagged = (docs: Array<{ id: string; notes: string | null }>) =>
    docs.filter((d) => d.notes?.startsWith(OPEN_NOTE_PREFIX)).map((d) => d.id);

  const [receiving, wipCompletion, shipments, disposals] = await Promise.all([
    db.receivingTransaction.findMany({
      select: { id: true, notes: true },
    }),
    db.wipCompletion.findMany({ select: { id: true, notes: true } }),
    db.shipment.findMany({ select: { id: true, notes: true } }),
    db.disposal.findMany({ select: { id: true, notes: true } }),
  ]);

  const docIds = [
    ...flagged(receiving),
    ...flagged(wipCompletion),
    ...flagged(shipments),
    ...flagged(disposals),
  ];
  if (docIds.length === 0) return;

  // Pallets this step RECEIVED are its own creations — drop them with their
  // putaway lines.
  const received = await db.pallet.findMany({
    where: { putawayLine: { documentId: { in: docIds } } },
    select: { id: true },
  });

  // Pallets this step DISPATCHED are pre-existing stock that
  // `reservePalletsAndCreatePickLines` flipped to NOT_AVAILABLE. They are not
  // ours to delete — they must go back on the shelf, or every re-run of this
  // step permanently consumed 4 more pallets (available 142 -> 138 -> 134).
  const reserved = await db.pickLine.findMany({
    where: { documentId: { in: docIds } },
    select: { palletId: true, fromLocationId: true },
  });

  await db.$transaction([
    // Notifications carry no FK to their document, so drop them explicitly —
    // otherwise a re-run orphans them on the approvers' bell.
    db.notification.deleteMany({ where: { targetId: { in: docIds } } }),
    db.putawayLine.deleteMany({ where: { documentId: { in: docIds } } }),
    db.pickLine.deleteMany({ where: { documentId: { in: docIds } } }),
    db.pallet.deleteMany({
      where: { id: { in: received.map((p) => p.id) } },
    }),
    ...reserved.map((line) =>
      db.pallet.update({
        where: { id: line.palletId },
        data: { status: "AVAILABLE", storageLocationId: line.fromLocationId },
      }),
    ),
    db.receivingTransaction.deleteMany({
      where: { id: { in: flagged(receiving) } },
    }),
    db.wipCompletion.deleteMany({
      where: { id: { in: flagged(wipCompletion) } },
    }),
    db.shipment.deleteMany({ where: { id: { in: flagged(shipments) } } }),
    db.disposal.deleteMany({ where: { id: { in: flagged(disposals) } } }),
  ]);
}
