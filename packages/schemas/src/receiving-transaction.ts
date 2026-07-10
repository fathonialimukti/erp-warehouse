import { z } from 'zod';
import { createListInputSchema } from './common';
import { transactionApprovalStatusSchema, approvalHistorySchema } from './transaction-common';

export const receivingTransactionListInputSchema = createListInputSchema({
  approvalStatus: z.union([transactionApprovalStatusSchema, z.array(transactionApprovalStatusSchema)]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
  supplierId: z.string().optional(),
});

export const receivingTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const receivingTransactionFileSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  size: z.coerce.number().min(0),
  dataUrl: z.string().optional(),
  url: z.string().optional(),
  storedName: z.string().optional(),
});

// Form schema — works for both create and update
export const receivingTransactionFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  supplierId: z.string().optional(),
  purchaseOrderRef: z.string().optional(),
  deliveryNoteRef: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  vehiclePlate: z.string().optional(),
  files: z.array(receivingTransactionFileSchema).optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(receivingTransactionItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createReceivingTransactionSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  supplierId: z.string().min(1, 'Supplier is required'),
  purchaseOrderRef: z.string().optional(),
  deliveryNoteRef: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  vehiclePlate: z.string().optional(),
  files: z.array(receivingTransactionFileSchema).optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(receivingTransactionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

export type ReceivingTransactionItem = z.infer<typeof receivingTransactionItemSchema>;
export type ReceivingTransactionFormValues = z.infer<typeof receivingTransactionFormSchema>;
export type CreateReceivingTransactionInput = z.infer<typeof createReceivingTransactionSchema>;
