import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    buildApprovalActionData,
    buildTransactionBaseWhere,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    ensureNoDuplicateTransactionItems,
    ensureTransactionPalletTypesMatchSku,
    normalizeText,
    approvalStatusValues,
    summarizeItemTransaction,
} from "./transaction-common";
import {
    approvalHistorySchema,
    transactionApprovalStatusSchema,
    transactionListInputSchema,
} from "./transaction-schemas.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const foundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU is required"),
    palletTypeId: z.string().min(1, "Pallet type is required"),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

const foundTransactionInputSchema = z.object({
    date: z.coerce.date().optional(),
    findingType: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    items: z.array(foundTransactionItemSchema).min(1, "At least one item is required"),
    approvalHistory: approvalHistorySchema,
});

const includeFoundTransaction = {
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            sku: true,
            palletType: true,
            pallets: {
                select: {
                    id: true,
                },
            },
        },
    },
} as const;

export const foundTransactionRouter = router({
    list: protectedProcedure.input(transactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { reference: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { findingType: { contains: search, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.foundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeFoundTransaction,
            }),
            ctx.db.foundTransaction.count({ where }),
        ]);

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.foundTransaction.findUnique({ where: { id: input.id }, include: includeFoundTransaction });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'foundTransaction.notFound') });
        }

        return summarizeItemTransaction(row);
    }),

    create: transactionalProtectedProcedure.input(foundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, "foundTransaction.duplicateItem");
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: "foundTransaction.palletTypeNotFound",
            palletTypeMismatch: "foundTransaction.palletTypeMismatch",
        });

        const created = await ctx.db.foundTransaction.create({
            data: {
                date: input.date ?? new Date(),
                findingType: normalizeText(input.findingType),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? "DRAFT",
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        palletTypeId: item.palletTypeId,
                        quantity: item.quantity,
                    })),
                },
            },
            include: includeFoundTransaction,
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "found_transaction",
            resourceId: created.id,
            message: `Membuat transaksi temuan ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(foundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            id: true,
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOnly(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'foundTransaction.notFound'));

            const generatedPalletCount = existing?.items.reduce((sum, item) => sum + item.pallets.length, 0) ?? 0;
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'foundTransaction.cannotUpdateGeneratedPallets'),
                });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, "foundTransaction.duplicateItem");
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: "foundTransaction.palletTypeNotFound",
                palletTypeMismatch: "foundTransaction.palletTypeMismatch",
            });

            const updated = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    findingType: normalizeText(input.findingType),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                        })),
                    },
                },
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "found_transaction",
                resourceId: updated.id,
                message: `Memperbarui transaksi temuan ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.foundTransaction.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    include: {
                        pallets: { select: { id: true } },
                    },
                },
            },
        });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'foundTransaction.notFound') });
        }

        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'foundTransaction.notFound'));

        const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
        if (generatedPalletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(ctx.locale, 'foundTransaction.cannotDeleteGeneratedPallets'),
            });
        }

        await ctx.db.foundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_temuan",
            resourceId: before.id,
            message: `Menghapus transaksi temuan ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'foundTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'foundTransaction.emptyItems') });
            }

            const generatedPalletCount = existing.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'foundTransaction.alreadyGenerated'),
                });
            }

            await ctx.db.pallet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.quantity }, () => ({
                        palletTypeId: item.palletTypeId,
                        status: "RECEIVED" as const,
                        receivedAt: existing.date,
                        foundTransactionItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: approved.id,
                message: `Menyetujui transaksi temuan ${approved.id}`,
                detail: {
                    before: {
                        approvalStatus: existing.approvalStatus,
                        approvalHistory: existing.approvalHistory,
                    },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'foundTransaction.notFound'));

            const rejected = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: rejected.id,
                message: `Menolak transaksi temuan ${rejected.id}`,
                detail: {
                    before: {
                        approvalStatus: existing?.approvalStatus ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
                    },
                    after: rejected,
                    rejectionMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
