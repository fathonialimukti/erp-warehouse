import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

// Loss transaction list input
export const lossTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

// Loss transaction item schema (item-based, consistent with all other transaction types)
export const lossTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
});

// Form schema — works for both create and update
export const lossTransactionFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  lossReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(lossTransactionItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createLossTransactionSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  lossReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(lossTransactionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

export type LossTransactionItem = z.infer<typeof lossTransactionItemSchema>;
export type LossTransactionFormValues = z.infer<typeof lossTransactionFormSchema>;
export type CreateLossTransactionInput = z.infer<typeof createLossTransactionSchema>;
