import { z } from 'zod';

// =============================================
// PURCHASE ORDER
// =============================================

export const purchaseOrderStatusValues = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'REJECTED',
  'RECEIVING',
  'CLOSED',
  'CANCELLED',
] as const;
export const purchaseOrderStatusSchema = z.enum(purchaseOrderStatusValues);

const poItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0).optional(),
  details: z.string().max(500).optional(),
});

export type PurchaseOrderItemInput = z.infer<typeof poItemSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(poItemSchema).min(1, 'At least one item is required'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  id: z.string().min(1),
  approvalStatus: z.enum(['DRAFT', 'PROPOSED']).optional(),
});

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

export const purchaseOrderIdSchema = z.object({ id: z.string().min(1) });

export const poApprovalActionSchema = z.object({
  id: z.string().min(1),
  message: z.string().max(2000).optional(),
});
