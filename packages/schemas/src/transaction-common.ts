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

// Common transaction schemas
export const transactionIdSchema = z.object({
  id: z.string(),
});

export const transactionApprovalSchema = z.object({
  id: z.string(),
  message: z.string().optional(),
});

export type ApprovalStatus = z.infer<typeof transactionApprovalStatusSchema>;
export type TransactionIdInput = z.infer<typeof transactionIdSchema>;
export type TransactionApprovalInput = z.infer<typeof transactionApprovalSchema>;