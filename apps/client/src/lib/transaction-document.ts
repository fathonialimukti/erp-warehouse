import type { IntlShape } from 'react-intl';
import { trpcClient } from './trpc';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRef {
  name?: string | null;
  email?: string | null;
}

/**
 * Loose union of all 9 transaction detail responses — fields are optional so
 * one normalizer covers every type (counterparty only where a type has one).
 */
export interface RawDetail {
  id?: string;
  documentNumber?: string | null;
  approvalStatus?: string;
  date?: string | Date;
  warehouse?: { name?: string | null } | null;
  supplier?: { name?: string | null } | null;
  recipient?: string | null;
  reference?: string | null;
  purchaseOrderRef?: string | null;
  deliveryNoteRef?: string | null;
  salesOrderRef?: string | null;
  shipmentNumber?: string | null;
  workOrderRef?: string | null;
  productionBatchNo?: string | null;
  originalReceivingId?: string | null;
  foundReason?: string | null;
  returnReason?: string | null;
  disposalReason?: string | null;
  lossReason?: string | null;
  createdBy?: UserRef | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | Date | null;
  createdAt?: string | Date;
  items?: Array<{
    id: string;
    sku?: { code?: string | null; name?: string | null } | null;
    quantity?: unknown;
    details?: string | null;
  }>;
  totalQuantity?: unknown;
}

export interface PrintDocItem {
  id: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  details: string;
}

/** Normalized document shape shared by every transaction type. */
export interface PrintDoc {
  number: string;
  status: string;
  date: string;
  warehouse: string;
  counterparty: string | null;
  reference: string | null;
  reason: string | null;
  items: PrintDocItem[];
  totalQuantity: number;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
}

// ─── Per-type adapter map (slug → tRPC detail query + optional meta extractors) ─

export interface TypeAdapter {
  fetch: (id: string) => Promise<unknown>;
  reference?: (d: RawDetail) => string | null;
  reason?: (d: RawDetail) => string | null;
}

export const TRANSACTION_TYPES = [
  'receiving',
  'wip-completion',
  'rma-receipt',
  'found',
  'shipment',
  'wip-issue',
  'return-to-supplier',
  'disposal',
  'loss',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ADAPTERS: Record<TransactionType, TypeAdapter> = {
  receiving: {
    fetch: (id) => trpcClient.receivingTransaction.detail.query({ id }),
    reference: (d) => d.purchaseOrderRef ?? d.deliveryNoteRef ?? null,
  },
  'wip-completion': {
    fetch: (id) => trpcClient.wipCompletion.detail.query({ id }),
    reference: (d) => d.workOrderRef ?? d.productionBatchNo ?? null,
  },
  'rma-receipt': {
    fetch: (id) => trpcClient.rmaReceipt.detail.query({ id }),
    reference: (d) => d.salesOrderRef ?? null,
    reason: (d) => d.returnReason ?? null,
  },
  found: {
    fetch: (id) => trpcClient.foundTransaction.detail.query({ id }),
    reference: (d) => d.reference ?? null,
    reason: (d) => d.foundReason ?? null,
  },
  shipment: {
    fetch: (id) => trpcClient.shipment.detail.query({ id }),
    reference: (d) => d.salesOrderRef ?? d.shipmentNumber ?? d.reference ?? null,
  },
  'wip-issue': {
    fetch: (id) => trpcClient.wipIssue.detail.query({ id }),
    reference: (d) => d.workOrderRef ?? d.reference ?? null,
  },
  'return-to-supplier': {
    fetch: (id) => trpcClient.returnToSupplier.detail.query({ id }),
    // Human-readable reference first; the raw originalReceivingId ULID is a fallback only.
    reference: (d) => d.reference ?? d.originalReceivingId ?? null,
    reason: (d) => d.returnReason ?? null,
  },
  disposal: {
    fetch: (id) => trpcClient.disposal.detail.query({ id }),
    reference: (d) => d.reference ?? null,
    reason: (d) => d.disposalReason ?? null,
  },
  loss: {
    fetch: (id) => trpcClient.lossTransaction.detail.query({ id }),
    reference: (d) => d.reference ?? null,
    reason: (d) => d.lossReason ?? null,
  },
};

export const isTransactionType = (value: string | undefined): value is TransactionType =>
  typeof value === 'string' && (TRANSACTION_TYPES as readonly string[]).includes(value);

// ─── Helpers (mirror _detail-shared conventions) ──────────────────────────────

export const numQty = (q: unknown): number => {
  if (typeof q === 'number') return q;
  if (q && typeof q === 'object' && typeof (q as { toNumber?: unknown }).toNumber === 'function') {
    return (q as { toNumber(): number }).toNumber();
  }
  return Number(q) || 0;
};

export const userName = (u?: UserRef | null): string | null => u?.name ?? u?.email ?? null;

export const formatDate = (value: string | Date | null | undefined, intl: IntlShape, withTime = false): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return withTime
    ? intl.formatDate(date, { dateStyle: 'medium', timeStyle: 'short', hour12: false })
    : intl.formatDate(date, { dateStyle: 'medium' });
};

export const normalizeDetail = (type: TransactionType, raw: unknown, intl: IntlShape): PrintDoc => {
  const d = raw as RawDetail;
  const adapter = ADAPTERS[type];
  return {
    number: d.documentNumber ?? d.id ?? '—',
    status: d.approvalStatus ?? '—',
    date: formatDate(d.date, intl) ?? '—',
    warehouse: d.warehouse?.name ?? '—',
    counterparty: d.supplier?.name ?? d.recipient ?? null,
    reference: adapter.reference?.(d) ?? null,
    reason: adapter.reason?.(d) ?? null,
    items: (d.items ?? []).map((item) => ({
      id: item.id,
      skuCode: item.sku?.code ?? '—',
      skuName: item.sku?.name ?? '—',
      quantity: numQty(item.quantity),
      details: item.details ?? '',
    })),
    totalQuantity: numQty(d.totalQuantity),
    createdBy: userName(d.createdBy),
    approvedBy: userName(d.approvedBy),
    approvedAt: formatDate(d.approvedAt, intl, true),
    createdAt: formatDate(d.createdAt, intl, true),
  };
};
