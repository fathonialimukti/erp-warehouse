import { z } from "zod";
import { createListInputSchema } from "./common";
import {
  transactionApprovalStatusSchema,
  approvalHistorySchema,
} from "./transaction-common";

export const disposalListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

export const disposalItemSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  details: z.string().optional(),
});

// Form schema — works for both create and update
export const disposalFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  disposalReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(disposalItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createDisposalSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  disposalReason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(disposalItemSchema).min(1, "At least one item is required"),
  approvalHistory: approvalHistorySchema,
});

export type DisposalItem = z.infer<typeof disposalItemSchema>;
export type DisposalFormValues = z.infer<typeof disposalFormSchema>;
export type CreateDisposalInput = z.infer<typeof createDisposalSchema>;
