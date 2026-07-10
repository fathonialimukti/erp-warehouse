import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

// Outbound transaction list input
export const outboundTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dispatchStatus: z.enum(['PENDING', 'PARTIAL', 'COMPLETED']).optional(),
  dispatchOpenStatus: z.enum(['OPEN', 'CLOSED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// Outbound transaction item schemas
export const outboundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(1, 'Quantity is required'),
  details: z.string().optional(),
  palletIds: z.array(z.string().min(1, 'Pallet ID is required')).optional().default([]),
});

// Outbound transaction create schemas
export const createOutboundTransactionSchema = z.object({
  id: z.string().optional(),
  documentNumber: z.string().optional(),
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
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  recipient: z.string().min(1, 'Recipient is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(outboundTransactionItemSchema).min(1, 'At least one item is required'),
});

export const dispatchPreviewInputSchema = z.object({
  outboundTransactionId: z.string().min(1),
});

export const dispatchAssignmentSchema = z.object({
  outboundTransactionItemId: z.string().min(1),
  palletId: z.string().min(1),
});

export const dispatchAssignInputSchema = z.object({
  outboundTransactionId: z.string().min(1),
  assignments: z.array(dispatchAssignmentSchema).min(1),
  message: z.string().optional(),
});

export type OutboundTransactionItem = z.infer<typeof outboundTransactionItemSchema>;
export type CreateOutboundTransactionInput = z.infer<typeof createOutboundTransactionSchema>;
export type CreateOutboundTransactionFormInput = z.infer<typeof createOutboundTransactionFormSchema>;
export type DispatchPreviewInput = z.infer<typeof dispatchPreviewInputSchema>;
export type DispatchAssignInput = z.infer<typeof dispatchAssignInputSchema>;