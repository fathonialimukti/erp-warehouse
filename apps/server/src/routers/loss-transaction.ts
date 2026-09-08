import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from "../lib/log-detail.js";
import { getMessage } from "../lib/locale.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import {
    buildApprovalActionData,
    buildTransactionBaseWhere,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    ensureNoDuplicateTransactionItems,
    normalizeText,
    summarizeItemTransaction,
    writeStockMovements,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import { notifyApprovalEvent } from '../lib/approval-notify.js';
import {
    lossTransactionListInputSchema,
    createLossTransactionSchema,
} from "@repo/schemas/transaction-loss";
import { buildPaginationMeta, buildPaginationParams, buildSortParams } from "../lib/list-query.js";

const includeLossTransaction = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true } },
    items: {
        include: {
            sku: true,
        },
    },
} as const;

/**
 * Whitelist of sortable column keys → Prisma orderBy builders.
 * Prevents arbitrary-field sorting. Unrecognised/missing sort falls back to date desc.
 */
const LOSS_TRANSACTION_SORTABLE_FIELDS: Record<string, (order: 'asc' | 'desc') => Record<string, unknown>> = {
    documentNumber: (order) => ({ documentNumber: order }),
    date: (order) => ({ date: order }),
    approvalStatus: (order) => ({ approvalStatus: order }),
};

const buildLossTransactionOrderBy = (input?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const sort = buildSortParams(input);
    if (sort) {
        const builder = LOSS_TRANSACTION_SORTABLE_FIELDS[sort.sortBy];
        if (builder) return builder(sort.sortOrder);
    }
    return { date: 'desc' as const };
};

export const lossTransactionRouter = router({
    list: protectedProcedure.use(hasPermission('loss@read')).input(lossTransactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                    { lossReason: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.lossTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: buildLossTransactionOrderBy(input),
            include: includeLossTransaction,
        });
        const total = await ctx.db.lossTransaction.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('loss@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.lossTransaction.findUnique({
            where: { id: input.id },
            include: includeLossTransaction,
        });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'lossTransaction.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('loss@create')).use(transactional).input(createLossTransactionSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'lossTransaction.duplicateItem');
        const created = await ctx.db.lossTransaction.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber: normalizeText(input.documentNumber),
                lossReason: normalizeText(input.lossReason),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                warehouseId: input.warehouseId,
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? 'DRAFT',
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                                                quantity: item.quantity,
                        details: normalizeText(item.details),
                    })),
                },
            },
            include: includeLossTransaction,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'loss_transaction',
            resourceId: created.id,
            message: `Membuat transaksi kehilangan ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('loss@update')).use(transactional)
        .input(createLossTransactionSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.lossTransaction.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, lossReason: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'lossTransaction.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'lossTransaction.cannotUpdate'));

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'lossTransaction.duplicateItem');
    

            const updated = await ctx.db.lossTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber: normalizeText(input.documentNumber),
                    lossReason: normalizeText(input.lossReason),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    warehouseId: input.warehouseId,
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                                                        quantity: item.quantity,
                            details: normalizeText(item.details),
                        })),
                    },
                },
                include: includeLossTransaction,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'loss_transaction',
                resourceId: updated.id,
                message: `Memperbarui transaksi kehilangan ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            if (input.approvalStatus === 'PROPOSED' && existing.approvalStatus !== 'PROPOSED') {
                await notifyApprovalEvent(ctx.db, {
                    transactionType: 'LOSS',
                    resource: 'loss',
                    documentId: updated.id,
                    documentNumber: updated.documentNumber,
                    actionUrl: `/outbound-transaction/loss/${updated.id}`,
                    actorId: ctx.user!.userId,
                    actorName: ctx.user!.name ?? ctx.user!.email,
                    status: 'PROPOSED',
                });
            }

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('loss@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.lossTransaction.findUnique({
            where: { id: input.id },
            include: includeLossTransaction,
        });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'lossTransaction.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'lossTransaction.cannotDelete'));

        await ctx.db.lossTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'loss_transaction',
            resourceId: before.id,
            message: `Menghapus transaksi kehilangan ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('loss@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.lossTransaction.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'lossTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'lossTransaction.emptyItems') });
            }

            // Loss is an administrative write-off — write stock movements only, no PickLines
            await writeStockMovements(ctx.db, {
                transactionType: 'LOSS',
                direction: 'OUT',
                documentId: existing.id,
                documentNumber: existing.reference,
                warehouseId: existing.warehouseId,
                transactionDate: existing.date,
                postedById: ctx.user!.userId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                                        quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.lossTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeLossTransaction,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'loss_transaction',
                resourceId: approved.id,
                message: `Menyetujui transaksi kehilangan ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });


            await notifyApprovalEvent(ctx.db, {
                transactionType: 'LOSS',
                resource: 'loss',
                documentId: approved.id,
                documentNumber: approved.documentNumber,
                actionUrl: `/outbound-transaction/loss/${approved.id}`,
                actorId: ctx.user!.userId,
                actorName: ctx.user!.name ?? ctx.user!.email,
                status: 'APPROVED',
                note: input.message ?? undefined,
            });
            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('loss@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.lossTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'lossTransaction.notFound'));

            const rejected = await ctx.db.lossTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'loss_transaction',
                resourceId: rejected.id,
                message: `Menolak transaksi kehilangan ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });


            await notifyApprovalEvent(ctx.db, {
                transactionType: 'LOSS',
                resource: 'loss',
                documentId: rejected.id,
                documentNumber: rejected.documentNumber,
                actionUrl: `/outbound-transaction/loss/${rejected.id}`,
                actorId: ctx.user!.userId,
                actorName: ctx.user!.name ?? ctx.user!.email,
                status: 'REJECTED',
                note: input.message ?? undefined,
            });
            return rejected;
        }),
});
