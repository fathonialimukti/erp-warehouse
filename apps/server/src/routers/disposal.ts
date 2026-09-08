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
    reservePalletsAndCreatePickLines,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import { notifyApprovalEvent } from '../lib/approval-notify.js';
import {
    disposalListInputSchema,
    createDisposalSchema,
} from "@repo/schemas/disposal";
import { buildPaginationMeta, buildPaginationParams, buildSortParams } from "../lib/list-query.js";

const includeDisposal = {
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
const DISPOSAL_SORTABLE_FIELDS: Record<string, (order: 'asc' | 'desc') => Record<string, unknown>> = {
    documentNumber: (order) => ({ documentNumber: order }),
    date: (order) => ({ date: order }),
    approvalStatus: (order) => ({ approvalStatus: order }),
};

const buildDisposalOrderBy = (input?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const sort = buildSortParams(input);
    if (sort) {
        const builder = DISPOSAL_SORTABLE_FIELDS[sort.sortBy];
        if (builder) return builder(sort.sortOrder);
    }
    return { date: 'desc' as const };
};

export const disposalRouter = router({
    list: protectedProcedure.use(hasPermission('disposal@read')).input(disposalListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { disposalReason: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.disposal.findMany({
            where,
            skip,
            take: limit,
            orderBy: buildDisposalOrderBy(input),
            include: includeDisposal,
        });
        const total = await ctx.db.disposal.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('disposal@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.disposal.findUnique({ where: { id: input.id }, include: includeDisposal });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'disposal.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('disposal@create')).use(transactional).input(createDisposalSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'disposal.duplicateItem');

        const created = await ctx.db.disposal.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber: normalizeText(input.documentNumber),
                disposalReason: normalizeText(input.disposalReason),
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
            include: includeDisposal,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'disposal',
            resourceId: created.id,
            message: `Membuat disposal ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('disposal@update')).use(transactional)
        .input(createDisposalSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.disposal.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, disposalReason: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'disposal.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'disposal.cannotUpdate'));

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'DISPOSAL' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'disposal.cannotUpdateReservedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'disposal.duplicateItem');

            const updated = await ctx.db.disposal.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber: normalizeText(input.documentNumber),
                    disposalReason: normalizeText(input.disposalReason),
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
                include: includeDisposal,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'disposal',
                resourceId: updated.id,
                message: `Memperbarui disposal ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            if (input.approvalStatus === 'PROPOSED' && existing.approvalStatus !== 'PROPOSED') {
                await notifyApprovalEvent(ctx.db, {
                    transactionType: 'DISPOSAL',
                    resource: 'disposal',
                    documentId: updated.id,
                    documentNumber: updated.documentNumber,
                    actionUrl: `/outbound-transaction/disposal/${updated.id}`,
                    actorId: ctx.user!.userId,
                    actorName: ctx.user!.name ?? ctx.user!.email,
                    status: 'PROPOSED',
                });
            }

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('disposal@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.disposal.findUnique({ where: { id: input.id }, include: includeDisposal });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'disposal.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'disposal.cannotDelete'));

        const reservedCount = await ctx.db.pickLine.count({
            where: { documentId: input.id, transactionType: 'DISPOSAL' },
        });
        if (reservedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'disposal.cannotDeleteReservedPallets') });
        }

        await ctx.db.disposal.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'disposal',
            resourceId: before.id,
            message: `Menghapus disposal ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('disposal@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.disposal.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'disposal.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'disposal.emptyItems') });
            }

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'DISPOSAL' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'disposal.alreadyReserved') });
            }

            await reservePalletsAndCreatePickLines(ctx.db, ctx.locale, {
                transactionType: 'DISPOSAL',
                documentId: existing.id,
                warehouseId: existing.warehouseId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.disposal.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeDisposal,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'disposal',
                resourceId: approved.id,
                message: `Menyetujui disposal ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });


            await notifyApprovalEvent(ctx.db, {
                transactionType: 'DISPOSAL',
                resource: 'disposal',
                documentId: approved.id,
                documentNumber: approved.documentNumber,
                actionUrl: `/outbound-transaction/disposal/${approved.id}`,
                actorId: ctx.user!.userId,
                actorName: ctx.user!.name ?? ctx.user!.email,
                status: 'APPROVED',
                note: input.message ?? undefined,
            });
            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('disposal@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.disposal.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'disposal.notFound'));

            const rejected = await ctx.db.disposal.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'disposal',
                resourceId: rejected.id,
                message: `Menolak disposal ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });


            await notifyApprovalEvent(ctx.db, {
                transactionType: 'DISPOSAL',
                resource: 'disposal',
                documentId: rejected.id,
                documentNumber: rejected.documentNumber,
                actionUrl: `/outbound-transaction/disposal/${rejected.id}`,
                actorId: ctx.user!.userId,
                actorName: ctx.user!.name ?? ctx.user!.email,
                status: 'REJECTED',
                note: input.message ?? undefined,
            });
            return rejected;
        }),
});
