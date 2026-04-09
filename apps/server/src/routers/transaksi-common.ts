import { statusApprovalValues } from "./approval-utils.js";
import { TRPCError } from "@trpc/server";

export { statusApprovalValues } from "./approval-utils.js";

export type ApprovalHistoryEntry = {
    process: string;
    userName: string;
    timeframe: string;
    message: string;
};

export type ApprovalStatus = (typeof statusApprovalValues)[number];

export const ensureDraftOnly = (
    statusApproval: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status DRAFT.",
) => {
    if (statusApproval !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const ensureActionableApprovalStatus = (
    statusApproval: ApprovalStatus | null | undefined,
    message = "Operasi hanya dapat dilakukan pada status MENUNGGU.",
) => {
    if (statusApproval !== "MENUNGGU") {
        throw new TRPCError({ code: "BAD_REQUEST", message });
    }
};

export const buildApprovalActionData = (
    approvalHistory: unknown,
    user: { userId: string; name?: string | null; email?: string | null },
    statusApproval: ApprovalStatus,
    message?: string,
) => {
    const existingHistory = Array.isArray(approvalHistory) ? approvalHistory : [];
    const userName = user.name ?? user.email ?? "Unknown user";
    const nextAction: ApprovalHistoryEntry = {
        process: statusApproval,
        userName,
        timeframe: new Date().toISOString(),
        message: message ?? "",
    };

    return {
        statusApproval,
        approvedById: user.userId,
        approvedAt: new Date(),
        approvalHistory: [...existingHistory, nextAction],
    };
};
