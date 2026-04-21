import { approvalStatusValues } from "./approval-utils.js";
import { TRPCError } from "@trpc/server";
import { getMessage, type ServerLocale } from "../lib/locale.js";
import type { DbClient } from "../lib/prisma.js";

export { approvalStatusValues } from "./approval-utils.js";

export interface TransactionItemIdentity {
    skuId: string;
    palletTypeId: string;
}

export const availableTransactionPalletStatuses = ["RECEIVED", "PLACED", "FOUND"] as const;

export type ApprovalHistoryEntry = {
    process: string;
    userName: string;
    timeframe: string;
    message: string;
};

export type ApprovalStatus = (typeof approvalStatusValues)[number];

export const normalizeText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

export const ensureNoDuplicateTransactionItems = (
    items: TransactionItemIdentity[],
    locale: ServerLocale,
    duplicateItemMessageKey: string,
) => {
    const keys = new Set<string>();
    for (const item of items) {
        const key = `${item.skuId}:${item.palletTypeId}`;
        if (keys.has(key)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, duplicateItemMessageKey),
            });
        }
        keys.add(key);
    }
};

export const ensureTransactionPalletTypesMatchSku = async (
    db: DbClient,
    items: TransactionItemIdentity[],
    locale: ServerLocale,
    messageKeys: {
        palletTypeNotFound: string;
        palletTypeMismatch: string;
    },
) => {
    const palletTypeIds = items.map((item) => item.palletTypeId);
    const palletTypeRows = await db.palletType.findMany({
        where: { id: { in: palletTypeIds } },
        select: { id: true, skuId: true },
    });

    const skuByPalletTypeId = new Map(palletTypeRows.map((row) => [row.id, row.skuId]));

    for (const item of items) {
        const skuId = skuByPalletTypeId.get(item.palletTypeId);
        if (!skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, messageKeys.palletTypeNotFound, {
                    palletTypeId: item.palletTypeId,
                }),
            });
        }
        if (skuId !== item.skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(locale, messageKeys.palletTypeMismatch, {
                    palletTypeId: item.palletTypeId,
                    skuId: item.skuId,
                }),
            });
        }
    }
};

export const ensureNoDuplicatePalletIds = (
    palletIds: string[],
    locale: ServerLocale,
    duplicatePalletMessageKey: string,
) => {
    const uniqueIds = new Set(palletIds);
    if (uniqueIds.size !== palletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: getMessage(locale, duplicatePalletMessageKey),
        });
    }
};

export const ensurePalletsAvailableForTransaction = async (
    db: DbClient,
    palletIds: string[],
    locale: ServerLocale,
    messageKeys: {
        palletsNotFound: string;
        palletsInvalid: string;
    },
) => {
    const pallets = await db.pallet.findMany({
        where: { id: { in: palletIds } },
        select: { id: true, status: true },
    });

    if (pallets.length !== palletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: getMessage(locale, messageKeys.palletsNotFound),
        });
    }

    const invalidPallet = pallets.find(
        (pallet) => !availableTransactionPalletStatuses.includes(pallet.status as (typeof availableTransactionPalletStatuses)[number]),
    );

    if (invalidPallet) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: getMessage(locale, messageKeys.palletsInvalid),
        });
    }
};

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
    message = "Operasi hanya dapat dilakukan pada status PROPOSED.",
) => {
    if (approvalStatus !== "PROPOSED") {
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

export const buildTransactionBaseWhere = (input?: {
    approvalStatus?: ApprovalStatus;
    dateFrom?: Date;
    dateTo?: Date;
}): Record<string, unknown> => ({
    ...(input?.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
    ...(input?.dateFrom || input?.dateTo
        ? {
              date: {
                  ...(input?.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input?.dateTo ? { lte: input.dateTo } : {}),
              },
          }
        : {}),
});

export const summarizeItemTransaction = <
    T extends { items: Array<{ quantity: number; pallets: Array<unknown> }> },
>(
    row: T,
) => ({
    ...row,
    totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
    totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
});
