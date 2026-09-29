import { z } from "zod";
import { createListInputSchema } from "./common";
import {
  transactionApprovalStatusSchema,
  approvalHistorySchema,
} from "./transaction-common";

// Found transaction list input
export const foundTransactionListInputSchema = createListInputSchema({
  approvalStatus: transactionApprovalStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
});

// Found transaction item schemas
export const foundTransactionItemSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// Form schema — works for both create and update
export const foundTransactionFormSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.any().optional(),
  foundReason: z.string().optional(),
  foundLocation: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(foundTransactionItemSchema).optional(),
});

// Strict schema for tRPC create mutation
export const createFoundTransactionSchema = z.object({
  documentNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  foundReason: z.string().optional(),
  foundLocation: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z
    .array(foundTransactionItemSchema)
    .min(1, "At least one item is required"),
  approvalHistory: approvalHistorySchema,
});

export type FoundTransactionItem = z.infer<typeof foundTransactionItemSchema>;
export type FoundTransactionFormValues = z.infer<
  typeof foundTransactionFormSchema
>;
export type CreateFoundTransactionInput = z.infer<
  typeof createFoundTransactionSchema
>;
