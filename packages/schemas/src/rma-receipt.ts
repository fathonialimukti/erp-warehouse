import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const rmaReceiptListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
  originalShipmentId: z.string().optional(),
});

export const rmaReceiptItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// Form schema — works for both create and update
export const rmaReceiptFormSchema = z.object({
  date: z.any().optional(),
  originalShipmentId: z.string().optional(),
  salesOrderRef: z.string().optional(),
  returnReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(rmaReceiptItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createRmaReceiptSchema = z.object({
  date: z.coerce.date().optional(),
  originalShipmentId: z.string().optional(),
  salesOrderRef: z.string().optional(),
  returnReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(rmaReceiptItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

// Strict schema for tRPC update mutation
export const updateRmaReceiptSchema = createRmaReceiptSchema
  .partial()
  .extend({ id: z.string().min(1) });

export type RmaReceiptItem = z.infer<typeof rmaReceiptItemSchema>;
export type RmaReceiptFormValues = z.infer<typeof rmaReceiptFormSchema>;
export type CreateRmaReceiptInput = z.infer<typeof createRmaReceiptSchema>;
export type UpdateRmaReceiptInput = z.infer<typeof updateRmaReceiptSchema>;
