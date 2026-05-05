import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

// Loss transaction list input
export const lossTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// Loss transaction create schemas
export const createLossTransactionSchema = z.object({
  date: z.coerce.date().optional(),
  lossReason: z.string().optional(),
  estimatedValue: z.coerce.number().nonnegative().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  palletIds: z.array(z.string().min(1)).min(1, 'At least one pallet is required'),
  approvalHistory: approvalHistorySchema,
});

export const createLossTransactionFormSchema = z.object({
  date: z.any().optional(),
  lossReason: z.string().optional(),
  estimatedValue: z.coerce.number().nonnegative().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  palletIds: z.array(z.string().min(1)).min(1, 'At least one pallet is required'),
});

export type CreateLossTransactionInput = z.infer<typeof createLossTransactionSchema>;
export type CreateLossTransactionFormInput = z.infer<typeof createLossTransactionFormSchema>;