import { TRPCError } from "@trpc/server";
import type { DbClient } from "./prisma.js";
import { notify } from "./notification-service.js";

/**
 * Applies a receiving transaction against its purchase order:
 * - increments PurchaseOrderItem.receivedQty by the linked item quantities
 * - blocks cumulative over-receipt beyond the ordered quantity
 * - moves the PO to RECEIVING (partial) or CLOSED (fully received)
 * - notifies the PO creator
 */
export const applyReceiptToPurchaseOrder = async (
  db: DbClient,
  params: {
    purchaseOrderId: string;
    actorId: string;
    actorName: string;
    receivingDocumentNumber: string | null;
    receivingId: string;
    /** Linked item quantities: purchaseOrderItemId → received quantity */
    lines: Array<{ purchaseOrderItemId: string; quantity: number }>;
  },
): Promise<void> => {
  const po = await db.purchaseOrder.findUnique({
    where: { id: params.purchaseOrderId },
    include: { items: true },
  });
  if (!po) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Purchase order not found",
    });
  }
  if (po.status !== "APPROVED" && po.status !== "RECEIVING") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Purchase order ${po.documentNumber ?? po.id} is not open for receiving`,
    });
  }

  for (const line of params.lines) {
    const poItem = po.items.find(
      (item) => item.id === line.purchaseOrderItemId,
    );
    if (!poItem) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Receiving line does not belong to the linked purchase order",
      });
    }
  }

  // Atomic compare-and-set per line: the conditional updateMany re-checks
  // the outstanding quantity on the locked row, so two concurrent approvals
  // can never over-receive the same PO line.
  for (const line of params.lines) {
    const poItem = po.items.find(
      (item) => item.id === line.purchaseOrderItemId,
    )!;
    const ordered = poItem.quantity.toNumber();
    const result = await db.purchaseOrderItem.updateMany({
      where: {
        id: line.purchaseOrderItemId,
        receivedQty: { lte: ordered - line.quantity },
      },
      data: { receivedQty: { increment: line.quantity } },
    });
    if (result.count !== 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Over-receipt blocked: ordered ${ordered} on purchase order line, attempting to receive ${line.quantity}`,
      });
    }
  }

  const items = await db.purchaseOrderItem.findMany({
    where: { purchaseOrderId: po.id },
  });
  const fullyReceived = items.every(
    (item) => item.receivedQty.toNumber() >= item.quantity.toNumber(),
  );
  const nextStatus = fullyReceived ? "CLOSED" : "RECEIVING";
  await db.purchaseOrder.update({
    where: { id: po.id },
    data: { status: nextStatus },
  });

  if (po.createdById && po.createdById !== params.actorId) {
    await notify(db, {
      users: [po.createdById],
      title: fullyReceived
        ? "Purchase order fully received"
        : "Purchase order receiving update",
      message: `${po.documentNumber ?? po.id} received against ${params.receivingDocumentNumber ?? "a receiving transaction"}. Status: ${nextStatus}.`,
      link: "/purchase-order",
      causer: params.actorId,
      type: fullyReceived ? "SUCCESS" : "INFO",
      targetType: "PURCHASE_ORDER",
      targetId: po.id,
    });
  }
};
