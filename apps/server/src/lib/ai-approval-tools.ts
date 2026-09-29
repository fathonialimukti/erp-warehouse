import { tool } from "ai";
import { z } from "zod";
import { prisma } from "./prisma.js";

/**
 * Server-side AI tools for Approval Narratives.
 *
 * `get_approval_queue` aggregates every PROPOSED transaction across all 10
 * inbound/outbound/internal models into a flat, business-friendly list.
 * `get_transaction_summary` returns the line-item detail for one transaction
 * so the AI can narrate it in plain language (no raw JSON).
 *
 * Both tools are fully deterministic (no LLM) and never throw — they return
 * structured error shapes so the chat endpoint degrades gracefully.
 */

const HIGH_VALUE_THRESHOLD = 1_000_000;

/**
 * The 10 transaction models that share the approval workflow
 * (id, documentNumber, warehouseId, createdById, approvalStatus,
 * items + warehouse + createdBy relations).
 */
const APPROVAL_MODELS = [
  "receivingTransaction",
  "wipCompletion",
  "rmaReceipt",
  "foundTransaction",
  "shipment",
  "wipIssue",
  "returnToSupplier",
  "disposal",
  "subinventoryTransfer",
  "lossTransaction",
] as const;

type ApprovalModel = (typeof APPROVAL_MODELS)[number];

/** Shared include for the 9 models whose items have a `sku` relation. */
const APPROVAL_INCLUDE = {
  items: { include: { sku: true } },
  warehouse: true,
  createdBy: true,
} as const;

/** Shared where clause: only transactions awaiting approval. */
const PROPOSED_WHERE = { approvalStatus: "PROPOSED" } as const;

interface ApprovalItemRow {
  quantity: unknown;
  sku: { code: string | null; name: string; standardCost: unknown } | null;
}

interface ApprovalRow {
  id: string;
  documentNumber: string | null;
  approvalStatus: string;
  createdAt: Date;
  warehouse: { name: string } | null;
  createdBy: { name: string | null } | null;
  items: ApprovalItemRow[];
}

interface QueueItem {
  transactionType: string;
  transactionId: string;
  documentNumber?: string;
  warehouseName: string;
  skuCount: number;
  totalQuantity: number;
  totalValue: number;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface SummaryItem {
  skuCode: string | null;
  skuName: string;
  quantity: number;
  unitPrice?: number;
  value: number;
}

interface TransactionSummary {
  type: string;
  id: string;
  documentNumber?: string;
  warehouseName: string;
  status: string;
  createdByName: string;
  createdAt: string;
  items: SummaryItem[];
  totalValue: number;
  flags: string[];
}

/**
 * Minimal structural view of a Prisma delegate for the 9 approval models that
 * share the same item shape. All 9 delegates are structurally compatible for
 * findMany/findFirst with the approval include, so a single cast is safe.
 */
interface ApprovalDelegate {
  findMany(args: {
    where: { approvalStatus: string };
    include: typeof APPROVAL_INCLUDE;
  }): Promise<ApprovalRow[]>;
  findFirst(args: {
    where: { id: string; approvalStatus: string };
    include: typeof APPROVAL_INCLUDE;
  }): Promise<ApprovalRow | null>;
}

function delegateFor(model: ApprovalModel): ApprovalDelegate {
  // The union of 10 delegates can't be called directly; all 9 non-subinventory
  // models return rows structurally assignable to ApprovalRow.
  return prisma[model] as unknown as ApprovalDelegate;
}

/** PROPOSED transactions for one model, normalized to ApprovalRow. */
async function findProposed(model: ApprovalModel): Promise<ApprovalRow[]> {
  if (model === "subinventoryTransfer") {
    // SubinventoryTransferItem has no sku/quantity — one pallet per item.
    const rows = await prisma.subinventoryTransfer.findMany({
      where: PROPOSED_WHERE,
      include: {
        items: { include: { pallet: { include: { sku: true } } } },
        warehouse: true,
        createdBy: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      documentNumber: r.documentNumber,
      approvalStatus: r.approvalStatus,
      createdAt: r.createdAt,
      warehouse: r.warehouse,
      createdBy: r.createdBy,
      items: r.items.map((it) => ({
        quantity: 1,
        sku: it.pallet?.sku ?? null,
      })),
    }));
  }
  return delegateFor(model).findMany({
    where: PROPOSED_WHERE,
    include: APPROVAL_INCLUDE,
  });
}

/** One PROPOSED transaction by id, normalized to ApprovalRow (null if absent). */
async function findOne(
  model: ApprovalModel,
  id: string,
): Promise<ApprovalRow | null> {
  if (model === "subinventoryTransfer") {
    const row = await prisma.subinventoryTransfer.findFirst({
      where: { id, approvalStatus: "PROPOSED" },
      include: {
        items: { include: { pallet: { include: { sku: true } } } },
        warehouse: true,
        createdBy: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      documentNumber: row.documentNumber,
      approvalStatus: row.approvalStatus,
      createdAt: row.createdAt,
      warehouse: row.warehouse,
      createdBy: row.createdBy,
      items: row.items.map((it) => ({
        quantity: 1,
        sku: it.pallet?.sku ?? null,
      })),
    };
  }
  return delegateFor(model).findFirst({
    where: { id, approvalStatus: "PROPOSED" },
    include: APPROVAL_INCLUDE,
  });
}

/** Normalize one transaction row into a queue item. */
function toQueueItem(transactionType: string, row: ApprovalRow): QueueItem {
  const items = row.items ?? [];
  const totalQuantity = items.reduce(
    (sum, it) => sum + Number(it.quantity ?? 0),
    0,
  );
  const totalValue = items.reduce(
    (sum, it) =>
      sum + Number(it.quantity ?? 0) * Number(it.sku?.standardCost ?? 0),
    0,
  );

  const item: QueueItem = {
    transactionType,
    transactionId: row.id,
    warehouseName: row.warehouse?.name ?? "Unknown",
    skuCount: items.length,
    totalQuantity,
    totalValue: Math.round(totalValue),
    status: row.approvalStatus,
    createdByName: row.createdBy?.name ?? "Unknown",
    createdAt: row.createdAt.toISOString(),
  };
  if (row.documentNumber) item.documentNumber = row.documentNumber;
  return item;
}

/** Normalize one transaction row into a full summary with line items + flags. */
function toSummary(
  transactionType: string,
  row: ApprovalRow,
): TransactionSummary {
  const items = row.items ?? [];
  const summaryItems: SummaryItem[] = items.map((it) => {
    const quantity = Number(it.quantity ?? 0);
    const unitPrice =
      it.sku?.standardCost === null || it.sku?.standardCost === undefined
        ? undefined
        : Number(it.sku.standardCost);
    const value = quantity * (unitPrice ?? 0);
    const summaryItem: SummaryItem = {
      skuCode: it.sku?.code ?? null,
      skuName: it.sku?.name ?? "Unknown",
      quantity,
      value: Math.round(value),
    };
    if (unitPrice !== undefined) summaryItem.unitPrice = unitPrice;
    return summaryItem;
  });

  const totalValue = summaryItems.reduce((sum, it) => sum + it.value, 0);
  const flags: string[] = [];
  if (totalValue > HIGH_VALUE_THRESHOLD) flags.push("HIGH_VALUE");
  if (summaryItems.length === 1) flags.push("SINGLE_ITEM");
  if (!row.warehouse) flags.push("NO_WAREHOUSE");

  const summary: TransactionSummary = {
    type: transactionType,
    id: row.id,
    warehouseName: row.warehouse?.name ?? "Unknown",
    status: row.approvalStatus,
    createdByName: row.createdBy?.name ?? "Unknown",
    createdAt: row.createdAt.toISOString(),
    items: summaryItems,
    totalValue: Math.round(totalValue),
    flags,
  };
  if (row.documentNumber) summary.documentNumber = row.documentNumber;
  return summary;
}

export const approvalTools = {
  get_approval_queue: tool({
    description:
      "Get the queue of transactions currently awaiting approval (PROPOSED status) " +
      "across all transaction types: receiving, WIP completion, RMA receipt, found, " +
      "shipment, WIP issue, return to supplier, disposal, subinventory transfer, and loss. " +
      "Each item includes the transaction type, document number, warehouse, SKU count, " +
      "total quantity, total value, and who created it. " +
      "Use this when the user asks about pending approvals, what needs approval, " +
      "or wants an approval overview. Then call get_transaction_summary for the " +
      "transaction(s) the user cares about.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const results = await Promise.all(APPROVAL_MODELS.map(findProposed));

        const items: QueueItem[] = [];
        APPROVAL_MODELS.forEach((model, i) => {
          for (const row of results[i] ?? []) {
            items.push(toQueueItem(model, row));
          }
        });

        // Highest value first — the AI narrates the urgent ones first.
        items.sort((a, b) => b.totalValue - a.totalValue);
        return { items };
      } catch (error) {
        return {
          items: [],
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  }),

  get_transaction_summary: tool({
    description:
      "Get the full line-item summary of a single transaction awaiting approval, " +
      "including SKU codes, quantities, unit prices, total value, and rule-based flags " +
      "(HIGH_VALUE, SINGLE_ITEM, NO_WAREHOUSE). " +
      "Pass the transactionType exactly as returned by get_approval_queue " +
      '(e.g. "receivingTransaction") and the transaction id. ' +
      "Returns null if the transaction is not found or not in PROPOSED status.",
    inputSchema: z.object({
      transactionType: z
        .string()
        .describe(
          'The Prisma model name of the transaction, e.g. "receivingTransaction".',
        ),
      id: z.string().describe("The transaction id (ULID)."),
    }),
    execute: async ({ transactionType, id }) => {
      try {
        if (!APPROVAL_MODELS.includes(transactionType as ApprovalModel)) {
          return {
            summary: null,
            error: `Unknown transaction type: ${transactionType}`,
          };
        }
        const row = await findOne(transactionType as ApprovalModel, id);
        if (!row) return { summary: null };
        return { summary: toSummary(transactionType as ApprovalModel, row) };
      } catch (error) {
        return {
          summary: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  }),
};
