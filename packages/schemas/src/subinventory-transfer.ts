import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const subinventoryTransferListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

// Item moves a single pallet between two storage locations
export const subinventoryTransferItemSchema = z.object({
  palletId: z.string().min(1, 'Pallet is required'),
  fromLocationId: z.string().min(1, 'Source location is required'),
  toLocationId: z.string().min(1, 'Destination location is required'),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: 'Source and destination locations must be different',
  path: ['toLocationId'],
});

// Form schema — works for both create and update
export const subinventoryTransferFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  transferReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(subinventoryTransferItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createSubinventoryTransferSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  transferReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(subinventoryTransferItemSchema).min(1, 'At least one pallet transfer is required'),
  approvalHistory: approvalHistorySchema,
});

export type SubinventoryTransferItem = z.infer<typeof subinventoryTransferItemSchema>;
export type SubinventoryTransferFormValues = z.infer<typeof subinventoryTransferFormSchema>;
export type CreateSubinventoryTransferInput = z.infer<typeof createSubinventoryTransferSchema>;
