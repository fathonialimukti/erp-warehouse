import { approvalStatusValues } from "./approval-utils.js";
import { TRPCError } from "@trpc/server";

export { approvalStatusValues } from "./approval-utils.js";

export type ApprovalHistoryEntry = {
    process: string;
    userName: string;
    timeframe: string;
    message: string;
};

export type ApprovalStatus = (typeof approvalStatusValues)[number];

export const ensureDraftOnly = (
    approvalStatus: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status DRAFT.",
) => {
    if (approvalStatus !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureActionableApprovalStatus = (
    approvalStatus: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status PENDING.",
) => {
    if (approvalStatus !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const buildApprovalActionData = (
    approvalHistory: unknown,
    user: { userId: string; name?: string | null; email?: string | null },
    approvalStatus: ApprovalStatus,
    message?: string,
) => {
    const existingHistory = Array.isArray(approvalHistory) ? approvalHistory : [];
    const userName = user.name ?? user.email ?? "Unknown user";
    const nextAction: ApprovalHistoryEntry = {
        process: approvalStatus,
        userName,
        timeframe: new Date().toISOString(),
        message: message ?? "",
    };

    return {
        approvalStatus,
        approvedById: user.userId,
        approvedAt: new Date(),
        approvalHistory: [...existingHistory, nextAction],
    };
};
