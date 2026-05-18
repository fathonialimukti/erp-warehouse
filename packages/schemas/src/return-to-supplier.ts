import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const returnToSupplierListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
  supplierId: z.string().optional(),
});

export const returnToSupplierItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
});

// Form schema — works for both create and update
export const returnToSupplierFormSchema = z.object({
  date: z.any().optional(),
  supplierId: z.string().optional(),
  originalReceivingId: z.string().optional(),
  returnReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(returnToSupplierItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createReturnToSupplierSchema = z.object({
  date: z.coerce.date().optional(),
  supplierId: z.string().min(1, 'Supplier is required'),
  originalReceivingId: z.string().optional(),
  returnReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(returnToSupplierItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

// Strict schema for tRPC update mutation
export const updateReturnToSupplierSchema = createReturnToSupplierSchema
  .partial()
  .extend({ id: z.string().min(1) });

export type ReturnToSupplierItem = z.infer<typeof returnToSupplierItemSchema>;
export type ReturnToSupplierFormValues = z.infer<typeof returnToSupplierFormSchema>;
export type CreateReturnToSupplierInput = z.infer<typeof createReturnToSupplierSchema>;
export type UpdateReturnToSupplierInput = z.infer<typeof updateReturnToSupplierSchema>;
