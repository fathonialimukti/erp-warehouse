import { z } from "zod";
import { createListInputSchema } from "./common";
import {
  transactionApprovalStatusSchema,
  approvalHistorySchema,
} from "./transaction-common";

// Inbound transaction list input
export const inboundTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

// Inbound transaction item schemas
export const inboundTransactionItemSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const inboundTransactionFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  type: z.string().optional(),
  size: z.coerce.number().min(0),
  dataUrl: z.string().optional(),
  url: z.string().optional(),
  storedName: z.string().optional(),
});

// Inbound transaction create schemas
export const createInboundTransactionSchema = z.object({
  id: z.string().optional(),
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  sender: z.string().optional(),
  reference: z.string().optional(),
  asnNumber: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  bolNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  vehiclePlate: z.string().optional(),
  files: z.array(inboundTransactionFileSchema).optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z
    .array(inboundTransactionItemSchema)
    .min(1, "At least one item is required"),
  approvalHistory: approvalHistorySchema,
});

export const createInboundTransactionFormSchema = z.object({
  id: z.string().optional(),
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  sender: z.string().optional(),
  reference: z.string().optional(),
  asnNumber: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  bolNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  vehiclePlate: z.string().optional(),
  files: z.array(inboundTransactionFileSchema).optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z
    .array(inboundTransactionItemSchema)
    .min(1, "At least one item is required"),
});

// Putaway schemas (inbound-specific)
export const putawayPreviewInputSchema = z.object({
  inboundTransactionId: z.string().min(1),
});

export const putawayAssignmentSchema = z.object({
  palletId: z.string().min(1),
  storageLocationId: z.string().min(1),
});

export const putawayAssignInputSchema = z.object({
  inboundTransactionId: z.string().min(1),
  assignments: z.array(putawayAssignmentSchema).min(1),
  message: z.string().optional(),
});

export type InboundTransactionItem = z.infer<
  typeof inboundTransactionItemSchema
>;
export type CreateInboundTransactionInput = z.infer<
  typeof createInboundTransactionSchema
>;
export type CreateInboundTransactionFormInput = z.infer<
  typeof createInboundTransactionFormSchema
>;
