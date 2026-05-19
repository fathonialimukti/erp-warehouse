import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const wipIssueListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

export const wipIssueItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
});

// Form schema — works for both create and update
export const wipIssueFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  workOrderRef: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(wipIssueItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createWipIssueSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  workOrderRef: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(wipIssueItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

// Strict schema for tRPC update mutation
export const updateWipIssueSchema = createWipIssueSchema
  .partial()
  .extend({ id: z.string().min(1) });

export type WipIssueItem = z.infer<typeof wipIssueItemSchema>;
export type WipIssueFormValues = z.infer<typeof wipIssueFormSchema>;
export type CreateWipIssueInput = z.infer<typeof createWipIssueSchema>;
export type UpdateWipIssueInput = z.infer<typeof updateWipIssueSchema>;
