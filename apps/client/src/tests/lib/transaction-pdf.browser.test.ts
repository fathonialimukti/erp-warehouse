import { describe, it, expect } from 'vitest';
import { buildTransactionPdfBlob } from '../../lib/transaction-pdf';
import type { PrintDoc } from '../../lib/transaction-document';

/** Resolved print.document.* strings — the generator stays i18n-agnostic. */
const labels = {
  number: 'Number',
  warehouse: 'Warehouse',
  counterparty: 'Counterparty',
  reference: 'Reference',
  reason: 'Reason',
  skuCode: 'SKU Code',
  skuName: 'SKU Name',
  qty: 'Qty',
  details: 'Details',
  total: 'Total',
  noItems: 'No items.',
  createdBy: 'Created by',
  approvedBy: 'Approved by',
  preparedBy: 'Prepared by',
};

const doc: PrintDoc = {
  number: 'RCV-20260908-0001',
  status: 'approved',
  date: 'Sep 8, 2026',
  warehouse: 'Main Warehouse',
  counterparty: 'PT Sumber Makmur',
  reference: 'PO-2026-0001',
  reason: null,
  items: [
    { id: '1', skuCode: 'SKU-001', skuName: 'Ball Valve 1"', quantity: 12.5, details: '' },
    { id: '2', skuCode: 'SKU-002', skuName: 'Hydraulic Hose', quantity: 3, details: 'Batch B-12' },
  ],
  totalQuantity: 15.5,
  createdBy: 'Admin',
  approvedBy: null,
  approvedAt: null,
  createdAt: 'Sep 8, 2026 10:00',
};

describe('buildTransactionPdfBlob', () => {
  it('returns an application/pdf blob starting with %PDF', async () => {
    const blob = buildTransactionPdfBlob(doc, 'Goods Received Note', labels);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
  });

  it('renders the empty-items branch (no counterparty, no reference, no reason)', () => {
    const blob = buildTransactionPdfBlob(
      { ...doc, items: [], counterparty: null, reference: null, reason: null },
      'Loss Report',
      labels,
    );

    expect(blob.size).toBeGreaterThan(0);
  });
});
