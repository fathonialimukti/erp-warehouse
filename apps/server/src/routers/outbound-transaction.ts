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
    ensureNoDuplicatePalletIds,
    ensurePalletsAvailableForTransaction,
    normalizeText,
    approvalStatusValues,
} from "./transaction-common";
import {
    approvalHistorySchema,
    transactionApprovalStatusSchema,
    transactionListInputSchema,
} from "./transaction-schemas.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const outboundTransactionInputSchema = z.object({
    outgoingLocationId: z.string().min(1, "Outgoing location is required"),
    date: z.coerce.date().optional(),
    notes: z.string().optional(),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    palletIds: z.array(z.string().min(1)).min(1, "At least one pallet is required"),
    approvalHistory: approvalHistorySchema,
});

const includeOutboundTransaction = {
    outgoingLocation: true,
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            pallet: {
                include: {
                    palletType: {
                        include: {
                            sku: true,
                        },
                    },
                },
            },
        },
    },
} as const;


export const outboundTransactionRouter = router({
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
                          { items: { some: { pallet: { id: { contains: search, mode: "insensitive" as const } } } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.outboundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeOutboundTransaction,
            }),
            ctx.db.outboundTransaction.count({ where }),
        ]);

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.outboundTransaction.findUnique({
            where: { id: input.id },
            include: includeOutboundTransaction,
        });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
        }

        return row;
    }),

    create: transactionalProtectedProcedure.input(outboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicatePalletIds(input.palletIds, ctx.locale, "outboundTransaction.duplicatePalletIds");
        await ensurePalletsAvailableForTransaction(ctx.db, input.palletIds, ctx.locale, {
            palletsNotFound: "outboundTransaction.palletsNotFound",
            palletsInvalid: "outboundTransaction.palletsInvalid",
        });

        const created = await ctx.db.outboundTransaction.create({
            data: {
                outgoingLocationId: input.outgoingLocationId,
                date: input.date ?? new Date(),
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? "DRAFT",
                items: {
                    create: input.palletIds.map((palletId) => ({ palletId })),
                },
            },
            include: includeOutboundTransaction,
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "transaksi_pengeluaran",
            resourceId: created.id,
            message: `Membuat transaksi keluar ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(outboundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({ where: { id: input.id } });
            ensureDraftOnly(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            ensureNoDuplicatePalletIds(input.palletIds, ctx.locale, "outboundTransaction.duplicatePalletIds");
            await ensurePalletsAvailableForTransaction(ctx.db, input.palletIds, ctx.locale, {
                palletsNotFound: "outboundTransaction.palletsNotFound",
                palletsInvalid: "outboundTransaction.palletsInvalid",
            });

            const updated = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: {
                    outgoingLocationId: input.outgoingLocationId,
                    date: input.date ?? new Date(),
                    notes: normalizeText(input.notes),
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.palletIds.map((palletId) => ({ palletId })),
                    },
                },
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: updated.id,
                message: `Memperbarui transaksi keluar ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.outboundTransaction.findUnique({ where: { id: input.id } });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
        }

        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'outboundTransaction.notFound'));

        await ctx.db.outboundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_pengeluaran",
            resourceId: before.id,
            message: `Menghapus transaksi keluar ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            palletId: true,
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            const palletIds = existing?.items.map((item) => item.palletId) ?? [];
            if (palletIds.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'outboundTransaction.emptyPallets') });
            }

            await ensurePalletsAvailableForTransaction(ctx.db, palletIds, ctx.locale, {
                palletsNotFound: "outboundTransaction.palletsNotFound",
                palletsInvalid: "outboundTransaction.palletsInvalid",
            });

            await ctx.db.pallet.updateMany({
                where: { id: { in: palletIds } },
                data: {
                    status: "DISPATCHED",
                    dispatchedAt: existing?.date ?? new Date(),
                    storageLocationId: null,
                },
            });

            const approved = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: approved.id,
                message: `Menyetujui transaksi keluar ${approved.id}`,
                detail: {
                    before: {
                        approvalStatus: existing?.approvalStatus ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
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
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            const rejected = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: rejected.id,
                message: `Menolak transaksi keluar ${rejected.id}`,
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
