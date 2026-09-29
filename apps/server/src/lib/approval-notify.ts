import { prisma, type DbClient } from "./prisma.js";
import { notify } from "./notification-service.js";
import { isMailConfigured, sendMail, wrapEmailHtml } from "./mailer.js";
import { logger } from "./logger.js";
import type { WarehouseTransactionType } from "../prisma/generated/client";

/**
 * Fires workflow notifications for transaction approval events:
 * - PROPOSED  → all users holding `<resource>@approve` (except the actor)
 * - APPROVED / REJECTED → the document creator (except the actor)
 *
 * Also sends emails to recipients who opted in (UserPreference.notifyEmail)
 * when SMTP is configured. Never throws into the approval transaction.
 */

const RESOURCE_LABEL: Record<WarehouseTransactionType, string> = {
  RECEIVING: "Receiving",
  WIP_COMPLETION: "WIP Completion",
  RMA_RECEIPT: "RMA Receipt",
  WIP_ISSUE: "WIP Issue",
  SHIPMENT: "Shipment",
  RETURN_TO_SUPPLIER: "Return to Supplier",
  DISPOSAL: "Disposal",
  SUBINVENTORY_TRANSFER: "Subinventory Transfer",
  LOSS: "Loss",
  FOUND: "Found",
};

interface DocRef {
  documentNumber: string | null;
  createdById: string;
}

async function fetchDoc(
  db: DbClient,
  transactionType: WarehouseTransactionType,
  documentId: string,
): Promise<DocRef | null> {
  const select = { documentNumber: true, createdById: true } as const;
  switch (transactionType) {
    case "RECEIVING":
      return db.receivingTransaction.findUnique({
        where: { id: documentId },
        select,
      });
    case "WIP_COMPLETION":
      return db.wipCompletion.findUnique({ where: { id: documentId }, select });
    case "RMA_RECEIPT":
      return db.rmaReceipt.findUnique({ where: { id: documentId }, select });
    case "FOUND":
      return db.foundTransaction.findUnique({
        where: { id: documentId },
        select,
      });
    case "WIP_ISSUE":
      return db.wipIssue.findUnique({ where: { id: documentId }, select });
    case "SHIPMENT":
      return db.shipment.findUnique({ where: { id: documentId }, select });
    case "RETURN_TO_SUPPLIER":
      return db.returnToSupplier.findUnique({
        where: { id: documentId },
        select,
      });
    case "DISPOSAL":
      return db.disposal.findUnique({ where: { id: documentId }, select });
    case "SUBINVENTORY_TRANSFER":
      return db.subinventoryTransfer.findUnique({
        where: { id: documentId },
        select,
      });
    case "LOSS":
      return db.lossTransaction.findUnique({
        where: { id: documentId },
        select,
      });
  }
}

async function findUserIdsWithPermission(
  db: DbClient,
  permission: string,
): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      role: { permissions: { some: { permission: { name: permission } } } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function emailRecipients(
  db: DbClient,
  userIds: string[],
  subject: string,
  bodyHtml: string,
): Promise<void> {
  try {
    if (!(await isMailConfigured())) return;
    const prefs = await db.userPreference.findMany({
      where: { userId: { in: userIds }, notifyEmail: true },
      include: { user: { select: { email: true, name: true } } },
    });
    for (const pref of prefs) {
      if (!pref.user.email) continue;
      await sendMail({
        to: pref.user.email,
        subject,
        html: wrapEmailHtml(subject, bodyHtml),
      });
    }
  } catch (error) {
    logger.warn({ err: error }, "approval-notify: email fan-out failed");
  }
}

export interface NotifyApprovalEventInput {
  transactionType: WarehouseTransactionType;
  /** Permission resource prefix, e.g. 'receiving' for receiving@approve. */
  resource: string;
  documentId: string;
  documentNumber?: string | null;
  /** Deep link to the document detail page. */
  actionUrl: string;
  actorId: string;
  actorName: string;
  status: "PROPOSED" | "APPROVED" | "REJECTED";
  /** Optional approval/rejection note. */
  note?: string;
}

export const notifyApprovalEvent = async (
  db: DbClient,
  params: NotifyApprovalEventInput,
): Promise<void> => {
  try {
    const label = RESOURCE_LABEL[params.transactionType];
    const docNo =
      params.documentNumber ??
      (await fetchDoc(db, params.transactionType, params.documentId))
        ?.documentNumber ??
      null;
    const docLabel = docNo
      ? `${label} ${docNo}`
      : `${label} ${params.documentId}`;

    let recipientIds: string[] = [];
    let title: string;
    let message: string;
    let type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";

    if (params.status === "PROPOSED") {
      const approverIds = await findUserIdsWithPermission(
        db,
        `${params.resource}@approve`,
      );
      recipientIds = approverIds.filter((id) => id !== params.actorId);
      title = `${label} awaiting approval`;
      message = `${docLabel} was submitted by ${params.actorName} and needs your approval.`;
      type = "INFO";
    } else if (params.status === "APPROVED") {
      const doc = await fetchDoc(db, params.transactionType, params.documentId);
      recipientIds = doc ? [doc.createdById] : [];
      title = `${label} approved`;
      message = `${docLabel} was approved by ${params.actorName}.`;
      type = "SUCCESS";
    } else {
      const doc = await fetchDoc(db, params.transactionType, params.documentId);
      recipientIds = doc ? [doc.createdById] : [];
      title = `${label} rejected`;
      message = `${docLabel} was rejected by ${params.actorName}.${params.note ? ` Note: ${params.note}` : ""}`;
      type = "WARNING";
    }

    recipientIds = recipientIds.filter((id) => id && id !== params.actorId);
    if (recipientIds.length === 0) return;

    await notify(db, {
      users: recipientIds,
      title,
      message,
      link: params.actionUrl,
      causer: params.actorId,
      type,
      targetType: params.transactionType,
      targetId: params.documentId,
    });

    // Email fan-out runs after notifyApprovalEvent returns — i.e. after the
    // caller's transaction commits — so it MUST use the global client: the
    // interactive-tx client is invalidated on commit/rollback.
    void emailRecipients(
      prisma,
      recipientIds,
      title,
      `<p>${message}</p><p><a href="${params.actionUrl}">Open document</a></p>`,
    );
  } catch (error) {
    // Workflow notifications are best-effort — never break the approval transaction.
    logger.warn({ err: error }, "notifyApprovalEvent failed");
  }
};
