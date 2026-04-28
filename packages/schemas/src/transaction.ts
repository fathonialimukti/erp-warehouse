import { z } from 'zod';

// Common transaction schemas
export const approvalStatusValues = ['DRAFT', 'PROPOSED', 'APPROVED', 'REJECTED'] as const;
export const transactionApprovalStatusSchema = z.enum(approvalStatusValues);

export const approvalHistorySchema = z.array(
  z.object({
    process: z.string(),
    userName: z.string(),
    timeframe: z.string(),
    message: z.string().default(''),
  }),
).optional();

// Transaction item schemas
export const transactionItemIdentitySchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
});

// Inbound transaction schemas
export const inboundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  details: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const inboundTransactionFileSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  type: z.string().optional(),
  size: z.coerce.number().min(0),
  dataUrl: z.string().optional(),
  url: z.string().optional(),
  storedName: z.string().optional(),
});

export const createInboundTransactionSchema = z.object({
  id: z.string().optional(),
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
  warehouseId: z.string().min(1, 'Warehouse is required'),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  message: z.string().optional(),
  items: z.array(inboundTransactionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

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

// Outbound transaction schemas
export const outboundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  details: z.string().optional(),
  palletIds: z.array(z.string().min(1, 'Pallet ID is required')).min(1, 'At least one pallet is required'),
});

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

// Found transaction schemas
export const foundTransactionItemSchema = z.object({
  skuId: z.string().min(1, 'SKU is required'),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export const createFoundTransactionSchema = z.object({
  date: z.coerce.date().optional(),
  findingType: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  approvalStatus: transactionApprovalStatusSchema.optional(),
  items: z.array(foundTransactionItemSchema).min(1, 'At least one item is required'),
  approvalHistory: approvalHistorySchema,
});

// Loss transaction schemas
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

// Common transaction schemas
export const transactionIdSchema = z.object({
  id: z.string(),
});

export const transactionApprovalSchema = z.object({
  id: z.string(),
  message: z.string().optional(),
});

export type ApprovalStatus = z.infer<typeof transactionApprovalStatusSchema>;
export type InboundTransactionItem = z.infer<typeof inboundTransactionItemSchema>;
export type CreateInboundTransactionInput = z.infer<typeof createInboundTransactionSchema>;
export type OutboundTransactionItem = z.infer<typeof outboundTransactionItemSchema>;
export type CreateOutboundTransactionInput = z.infer<typeof createOutboundTransactionSchema>;
export type FoundTransactionItem = z.infer<typeof foundTransactionItemSchema>;
export type CreateFoundTransactionInput = z.infer<typeof createFoundTransactionSchema>;
export type CreateLossTransactionInput = z.infer<typeof createLossTransactionSchema>;
export type TransactionIdInput = z.infer<typeof transactionIdSchema>;
export const createInboundTransactionFormSchema = z.object({
  id: z.string().optional(),
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
  warehouseId: z.string().min(1, 'Warehouse is required'),
  items: z.array(inboundTransactionItemSchema).min(1, 'At least one item is required'),
});

export type CreateInboundTransactionFormInput = z.infer<typeof createInboundTransactionFormSchema>;
export type TransactionApprovalInput = z.infer<typeof transactionApprovalSchema>;