import { z } from "zod";
import { createListInputSchema } from "../lib/list-query.js";
import { approvalStatusValues } from "./transaction-common";

export const transactionApprovalStatusSchema = z.enum(approvalStatusValues);

export const approvalHistoryEntrySchema = z.object({
    process: z.string(),
    userName: z.string(),
    timeframe: z.string(),
    message: z.string().default(""),
});

export const approvalHistorySchema = z.array(approvalHistoryEntrySchema).optional();

export const transactionListInputSchema = createListInputSchema({
    approvalStatus: transactionApprovalStatusSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});