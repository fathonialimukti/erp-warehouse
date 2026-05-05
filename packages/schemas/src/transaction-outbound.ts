import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

// Outbound transaction list input
export const outboundTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// Outbound transaction item schemas
export const outboundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  details: z.string().optional(),
  palletIds: z.array(z.string().min(1, 'Pallet ID is required')).min(1, 'At least one pallet is required'),
});

// Outbound transaction create schemas
export const createOutboundTransactionSchema = z.object({
  id: z.string().optional(),
  date: z.coerce.date().optional(),
  recipient: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(outboundTransactionItemSchema).min(1, 'At least one item is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  approvalHistory: approvalHistorySchema,
});

export const createOutboundTransactionFormSchema = z.object({
  id: z.string().optional(),
  date: z.any().optional(),
  recipient: z.string().min(1, 'Recipient is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(outboundTransactionItemSchema).min(1, 'At least one item is required'),
});

export type OutboundTransactionItem = z.infer<typeof outboundTransactionItemSchema>;
export type CreateOutboundTransactionInput = z.infer<typeof createOutboundTransactionSchema>;
export type CreateOutboundTransactionFormInput = z.infer<typeof createOutboundTransactionFormSchema>;