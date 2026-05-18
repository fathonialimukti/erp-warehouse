import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const wipCompletionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

export const wipCompletionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// Form schema — works for both create and update
export const wipCompletionFormSchema = z.object({
  date: z.any().optional(),
  workOrderRef: z.string().optional(),
  productionBatchNo: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(wipCompletionItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createWipCompletionSchema = z.object({
  date: z.coerce.date().optional(),
  workOrderRef: z.string().optional(),
  productionBatchNo: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(wipCompletionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

// Strict schema for tRPC update mutation
export const updateWipCompletionSchema = createWipCompletionSchema
  .partial()
  .extend({ id: z.string().min(1) });

export type WipCompletionItem = z.infer<typeof wipCompletionItemSchema>;
export type WipCompletionFormValues = z.infer<typeof wipCompletionFormSchema>;
export type CreateWipCompletionInput = z.infer<typeof createWipCompletionSchema>;
export type UpdateWipCompletionInput = z.infer<typeof updateWipCompletionSchema>;
