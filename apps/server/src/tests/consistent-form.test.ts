import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDisposalSchema, disposalFormSchema } from '@repo/schemas/disposal';
import { createFoundTransactionSchema, foundTransactionFormSchema } from '@repo/schemas/transaction-found';
import { createLossTransactionSchema, lossTransactionFormSchema } from '@repo/schemas/transaction-loss';
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from '@repo/schemas/purchase-order';
import { createReceivingTransactionSchema, receivingTransactionFormSchema } from '@repo/schemas/receiving-transaction';
import { createReturnToSupplierSchema, returnToSupplierFormSchema } from '@repo/schemas/return-to-supplier';
import { createRmaReceiptSchema, rmaReceiptFormSchema } from '@repo/schemas/rma-receipt';
import { createShipmentSchema, shipmentFormSchema } from '@repo/schemas/shipment';
import { createStockCountSchema, saveStockCountLinesSchema } from '@repo/schemas/stock-count';
import {
  createSubinventoryTransferSchema,
  subinventoryTransferFormSchema,
  subinventoryTransferItemSchema,
} from '@repo/schemas/subinventory-transfer';
import { createInboundTransactionFormSchema, createInboundTransactionSchema } from '@repo/schemas/transaction-inbound';
import { createOutboundTransactionFormSchema, createOutboundTransactionSchema } from '@repo/schemas/transaction-outbound';
import { createWipCompletionSchema, wipCompletionFormSchema } from '@repo/schemas/wip-completion';
import { createWipIssueSchema, wipIssueFormSchema } from '@repo/schemas/wip-issue';

type Schema = z.ZodType<unknown, unknown>;
type Payload = Record<string, unknown>;

/**
 * Lock the header + lines / header-only convention shared by every transaction
 * form: a header (warehouse/supplier/date/ref fields) plus an items[] array of
 * sku lines. Pure schema-level assertions — no tRPC procedures involved.
 */

type CreateFamilyMember = {
  name: string;
  schema: Schema;
  /** Header refs required by the create schema (removed one at a time below). */
  requiredHeaderRefs: readonly string[];
  /** Item quantity accepts numeric strings via z.coerce.number(). */
  coerceQuantity: boolean;
};

const createFamily: CreateFamilyMember[] = [
  { name: 'receiving', schema: createReceivingTransactionSchema, requiredHeaderRefs: ['warehouseId', 'supplierId'], coerceQuantity: true },
  { name: 'found', schema: createFoundTransactionSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'loss', schema: createLossTransactionSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'shipment', schema: createShipmentSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'disposal', schema: createDisposalSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'return-to-supplier', schema: createReturnToSupplierSchema, requiredHeaderRefs: ['warehouseId', 'supplierId'], coerceQuantity: true },
  { name: 'rma-receipt', schema: createRmaReceiptSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'wip-issue', schema: createWipIssueSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'wip-completion', schema: createWipCompletionSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'inbound', schema: createInboundTransactionSchema, requiredHeaderRefs: ['warehouseId'], coerceQuantity: true },
  { name: 'outbound', schema: createOutboundTransactionSchema, requiredHeaderRefs: [], coerceQuantity: false },
];

/** Valid header + lines payload. Extra keys are stripped by the loose objects. */
const validPayload = (overrides: Payload = {}): Payload => ({
  warehouseId: 'wh-1',
  supplierId: 'sup-1',
  date: '2026-09-23',
  reference: 'REF-001',
  items: [{ skuId: 'sku-1', quantity: 2 }],
  approvalHistory: [],
  ...overrides,
});

const firstItemOf = (parsed: Payload): Payload => {
  const items = parsed.items as Array<Payload> | undefined;
  const first = items?.[0];
  if (first === undefined) throw new Error('expected at least one parsed item');
  return first;
};

describe('header + lines payload (consistent form contract)', () => {
  it('accepts a valid header + lines payload for every create schema', () => {
    for (const member of createFamily) {
      expect(member.schema.safeParse(validPayload()).success, `${member.name}: valid payload must parse`).toBe(true);

      const parsed = member.schema.parse(validPayload()) as Payload;
      const firstItem = firstItemOf(parsed);
      expect(firstItem.skuId, `${member.name}: sku ref survives parsing`).toBe('sku-1');
      expect(firstItem.quantity, `${member.name}: quantity survives parsing`).toBe(2);
    }
  });

  it('rejects a payload missing a required header ref (warehouse/supplier)', () => {
    for (const member of createFamily) {
      for (const ref of member.requiredHeaderRefs) {
        const withoutRef = { ...validPayload() };
        delete withoutRef[ref];
        expect(member.schema.safeParse(withoutRef).success, `${member.name}: ${ref} is a required header ref`).toBe(false);
      }
    }
  });

  it('accepts a payload without the optional date/ref header fields', () => {
    for (const member of createFamily) {
      const result = member.schema.safeParse({
        warehouseId: 'wh-1',
        supplierId: 'sup-1',
        items: [{ skuId: 'sku-1', quantity: 2 }],
        approvalHistory: [],
      });
      expect(result.success, `${member.name}: date and reference are optional header fields`).toBe(true);
    }
  });

  it('rejects an empty or missing items array', () => {
    for (const member of createFamily) {
      expect(member.schema.safeParse(validPayload({ items: [] })).success, `${member.name}: items must be non-empty`).toBe(false);

      const withoutItems = { ...validPayload() };
      delete withoutItems.items;
      expect(member.schema.safeParse(withoutItems).success, `${member.name}: items are required`).toBe(false);
    }
  });

  it('rejects per-item quantities <= 0', () => {
    for (const member of createFamily) {
      for (const quantity of [0, -1]) {
        const result = member.schema.safeParse(validPayload({ items: [{ skuId: 'sku-1', quantity }] }));
        expect(result.success, `${member.name}: item quantity ${quantity} must be rejected`).toBe(false);
      }
    }
  });

  it('rejects items with an empty sku ref', () => {
    for (const member of createFamily) {
      const result = member.schema.safeParse(validPayload({ items: [{ skuId: '', quantity: 2 }] }));
      expect(result.success, `${member.name}: empty skuId must be rejected`).toBe(false);
    }
  });

  it('coerces string date input to a Date output and string quantity to a number', () => {
    for (const member of createFamily) {
      const parsed = member.schema.parse(validPayload()) as Payload;
      expect(parsed.date, `${member.name}: string date input is coerced to a Date`).toBeInstanceOf(Date);
    }
    for (const member of createFamily.filter((m) => m.coerceQuantity)) {
      const parsed = member.schema.parse(validPayload({ items: [{ skuId: 'sku-1', quantity: '3' }] })) as Payload;
      expect(firstItemOf(parsed).quantity, `${member.name}: string quantity is coerced to a number`).toBe(3);
    }
  });
});

describe('header-only shape (dual-use form schemas)', () => {
  const formFamily: Array<{ name: string; schema: Schema }> = [
    { name: 'receiving', schema: receivingTransactionFormSchema },
    { name: 'found', schema: foundTransactionFormSchema },
    { name: 'loss', schema: lossTransactionFormSchema },
    { name: 'shipment', schema: shipmentFormSchema },
    { name: 'disposal', schema: disposalFormSchema },
    { name: 'return-to-supplier', schema: returnToSupplierFormSchema },
    { name: 'rma-receipt', schema: rmaReceiptFormSchema },
    { name: 'wip-issue', schema: wipIssueFormSchema },
    { name: 'wip-completion', schema: wipCompletionFormSchema },
    { name: 'subinventory-transfer', schema: subinventoryTransferFormSchema },
  ];

  it('accepts a header-only payload without items (draft editing)', () => {
    for (const member of formFamily) {
      expect(member.schema.safeParse({ warehouseId: 'wh-1' }).success, `${member.name}: form schema must accept header-only`).toBe(true);

      const parsed = member.schema.parse({ warehouseId: 'wh-1' }) as Payload;
      expect(parsed.warehouseId, `${member.name}: header ref survives parsing`).toBe('wh-1');
      expect(parsed.items, `${member.name}: header-only payload has no items`).toBeUndefined();
    }
  });

  it('rejects a header-only payload on the strict create schema (lines are mandatory)', () => {
    for (const member of createFamily) {
      const result = member.schema.safeParse({ warehouseId: 'wh-1', supplierId: 'sup-1' });
      expect(result.success, `${member.name}: create schema must reject header-only`).toBe(false);
    }
  });

  it('keeps lines mandatory on the inbound/outbound dual-use form schemas', () => {
    expect(createInboundTransactionFormSchema.safeParse({ warehouseId: 'wh-1' }).success).toBe(false);
    expect(createOutboundTransactionFormSchema.safeParse({ recipient: 'r-1' }).success).toBe(false);
  });

  it('accepts a valid payload on the inbound/outbound form schemas', () => {
    expect(createInboundTransactionFormSchema.safeParse(validPayload()).success).toBe(true);
    expect(createOutboundTransactionFormSchema.safeParse(validPayload({ recipient: 'r-1' })).success).toBe(true);
  });
});

describe('create-only vs dual new+edit schemas', () => {
  it('keeps stock-count create-only: header-only payload, lines saved separately', () => {
    expect(createStockCountSchema.safeParse({ warehouseId: 'wh-1' }).success, 'stock count create is header-only').toBe(true);
    expect(createStockCountSchema.safeParse({}).success, 'warehouse is required').toBe(false);

    const parsed = createStockCountSchema.parse({ warehouseId: 'wh-1' }) as Payload;
    expect(parsed.items, 'stock count create payload carries no items').toBeUndefined();
  });

  it('validates stock-count line saves separately from the header', () => {
    expect(
      saveStockCountLinesSchema.safeParse({ id: 'sc-1', lines: [{ lineId: 'line-1', countedQty: 0 }] }).success,
      'zero count is a valid line',
    ).toBe(true);
    expect(saveStockCountLinesSchema.safeParse({ id: 'sc-1', lines: [] }).success, 'lines must be non-empty').toBe(false);
    expect(saveStockCountLinesSchema.safeParse({ id: 'sc-1', lines: [{ lineId: 'line-1', countedQty: -1 }] }).success, 'negative count rejected').toBe(false);
  });

  it('keeps purchase orders dual new+edit: update extends create with an id', () => {
    const createInput: Payload = { supplierId: 'sup-1', warehouseId: 'wh-1', items: [{ skuId: 'sku-1', quantity: 2 }] };
    expect(createPurchaseOrderSchema.safeParse(createInput).success).toBe(true);
    expect(updatePurchaseOrderSchema.safeParse(createInput).success, 'update requires an id').toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({ ...createInput, id: 'po-1' }).success).toBe(true);

    const withoutSupplier = { warehouseId: 'wh-1', items: [{ skuId: 'sku-1', quantity: 2 }] };
    expect(createPurchaseOrderSchema.safeParse(withoutSupplier).success, 'supplier is required').toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ supplierId: 'sup-1', warehouseId: 'wh-1' }).success, 'items are required').toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({ ...createInput, id: 'po-1', items: [] }).success, 'update still requires lines').toBe(false);
  });

  it('validates per-item refs and qty on the subinventory transfer item', () => {
    const validItem: Payload = { palletId: 'pallet-1', fromLocationId: 'loc-a', toLocationId: 'loc-b' };
    expect(subinventoryTransferItemSchema.safeParse(validItem).success).toBe(true);
    expect(
      subinventoryTransferItemSchema.safeParse({ palletId: 'pallet-1', fromLocationId: 'loc-a', toLocationId: 'loc-a' }).success,
      'source and destination must differ',
    ).toBe(false);
    expect(
      subinventoryTransferItemSchema.safeParse({ palletId: '', fromLocationId: 'loc-a', toLocationId: 'loc-b' }).success,
      'pallet ref is required',
    ).toBe(false);
    expect(createSubinventoryTransferSchema.safeParse({ warehouseId: 'wh-1', items: [] }).success, 'items must be non-empty').toBe(false);
  });
});