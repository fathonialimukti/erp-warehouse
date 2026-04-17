import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { logActivity } from "../lib/activity-log.js";
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

const inboundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU wajib diisi"),
    palletTypeId: z.string().min(1, "Jenis palet wajib diisi"),
    quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
});

const inboundTransactionInputSchema = z.object({
    date: z.coerce.date().optional(),
    notes: z.string().optional(),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    items: z.array(inboundTransactionItemSchema).min(1, "Minimal satu item"),
    approvalHistory: approvalHistorySchema,
});

const includeInboundTransaction = {
    incomingLocation: true,
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

export const inboundTransactionRouter = router({
    list: protectedProcedure.input(transactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { createdBy: { name: { contains: search, mode: "insensitive" as const } } },
                          { createdBy: { email: { contains: search, mode: "insensitive" as const } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.inboundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeInboundTransaction,
            }),
            ctx.db.inboundTransaction.count({ where }),
        ]);

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.inboundTransaction.findUnique({ where: { id: input.id }, include: includeInboundTransaction });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
        }

        return summarizeItemTransaction(row);
    }),

    create: transactionalProtectedProcedure.input(inboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
            palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
        });

        const created = await ctx.db.inboundTransaction.create({
            data: {
                date: input.date ?? new Date(),
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
            include: includeInboundTransaction,
        });
        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "inbound_transaction",
            resourceId: created.id,
            message: `Membuat transaksi masuk ${created.id}`,
            detail: {
                after: created,
            },
        });
        return created;
    }),

    update: transactionalProtectedProcedure
        .input(inboundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
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
            ensureDraftOnly(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound')); 

            const generatedPalletCount = existing?.items.reduce((sum, item) => sum + item.pallets.length, 0) ?? 0;
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'inboundTransaction.cannotUpdateGeneratedPallets'),
                });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
                palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
            });

            const updated = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
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
                include: includeInboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: updated.id,
                message: `Memperbarui transaksi masuk ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.inboundTransaction.findUnique({
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
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
        }

        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

        const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
        if (generatedPalletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(ctx.locale, 'inboundTransaction.cannotDeleteGeneratedPallets'),
            });
        }

        await ctx.db.inboundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "inbound_transaction",
            resourceId: before.id,
            message: `Menghapus transaksi masuk ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'inboundTransaction.emptyItems') });
            }

            const generatedPalletCount = existing.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'inboundTransaction.alreadyGenerated'),
                });
            }

            await ctx.db.pallet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.quantity }, () => ({
                        palletTypeId: item.palletTypeId,
                        status: "RECEIVED" as const,
                        receivedAt: existing.date,
                        inboundTransactionId: existing.id,
                        inboundTransactionItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeInboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: approved.id,
                message: `Menyetujui transaksi masuk ${approved.id}`,
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
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            const rejected = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });
            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: rejected.id,
                message: `Menolak transaksi masuk ${rejected.id}`,
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
