import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

// Found transaction list input
export const foundTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// Found transaction item schemas
export const foundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

// Found transaction create schemas
export const createFoundTransactionSchema = z.object({
  date: z.coerce.date().optional(),
  findingType: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  items: z.array(foundTransactionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

export const createFoundTransactionFormSchema = z.object({
  date: z.any().optional(),
  findingType: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(foundTransactionItemSchema).min(1, 'At least one item is required'),
});

export type FoundTransactionItem = z.infer<typeof foundTransactionItemSchema>;
export type CreateFoundTransactionInput = z.infer<typeof createFoundTransactionSchema>;
export type CreateFoundTransactionFormInput = z.infer<typeof createFoundTransactionFormSchema>;