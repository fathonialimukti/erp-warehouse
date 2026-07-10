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
    createPalletsAndPutawayLines,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    wipCompletionListInputSchema,
    createWipCompletionSchema,
} from "@repo/schemas/wip-completion";
import { buildPaginationMeta, buildPaginationParams, buildSortParams } from "../lib/list-query.js";

const includeWipCompletion = {
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
const WIP_SORTABLE_FIELDS: Record<string, (order: 'asc' | 'desc') => Record<string, unknown>> = {
    documentNumber: (order) => ({ documentNumber: order }),
    date: (order) => ({ date: order }),
    approvalStatus: (order) => ({ approvalStatus: order }),
};

const buildWipOrderBy = (input?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const sort = buildSortParams(input);
    if (sort) {
        const builder = WIP_SORTABLE_FIELDS[sort.sortBy];
        if (builder) return builder(sort.sortOrder);
    }
    return { date: 'desc' as const };
};

export const wipCompletionRouter = router({
    list: protectedProcedure.use(hasPermission('wip-completion@read')).input(wipCompletionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { workOrderRef: { contains: search, mode: 'insensitive' as const } },
                    { productionBatchNo: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.wipCompletion.findMany({
            where,
            skip,
            take: limit,
            orderBy: buildWipOrderBy(input),
            include: includeWipCompletion,
        });
        const total = await ctx.db.wipCompletion.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('wip-completion@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.wipCompletion.findUnique({ where: { id: input.id }, include: includeWipCompletion });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipCompletion.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('wip-completion@create')).use(transactional).input(createWipCompletionSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'wipCompletion.duplicateItem');
        const created = await ctx.db.wipCompletion.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber: normalizeText(input.documentNumber),
                workOrderRef: normalizeText(input.workOrderRef),
                productionBatchNo: normalizeText(input.productionBatchNo),
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
            include: includeWipCompletion,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'wip_completion',
            resourceId: created.id,
            message: `Membuat WIP completion ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('wip-completion@update')).use(transactional)
        .input(createWipCompletionSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipCompletion.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, workOrderRef: true, productionBatchNo: true,
                    reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipCompletion.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'wipCompletion.cannotUpdate'));

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'WIP_COMPLETION' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'wipCompletion.cannotUpdateGeneratedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'wipCompletion.duplicateItem');
    

            const updated = await ctx.db.wipCompletion.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber: normalizeText(input.documentNumber),
                    workOrderRef: normalizeText(input.workOrderRef),
                    productionBatchNo: normalizeText(input.productionBatchNo),
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
                include: includeWipCompletion,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'wip_completion',
                resourceId: updated.id,
                message: `Memperbarui WIP completion ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('wip-completion@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.wipCompletion.findUnique({ where: { id: input.id }, include: includeWipCompletion });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipCompletion.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'wipCompletion.cannotDelete'));

        const generatedCount = await ctx.db.putawayLine.count({
            where: { documentId: input.id, transactionType: 'WIP_COMPLETION' },
        });
        if (generatedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'wipCompletion.cannotDeleteGeneratedPallets') });
        }

        await ctx.db.wipCompletion.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'wip_completion',
            resourceId: before.id,
            message: `Menghapus WIP completion ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('wip-completion@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipCompletion.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'wipCompletion.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'wipCompletion.emptyItems') });
            }

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'WIP_COMPLETION' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'wipCompletion.alreadyGenerated') });
            }

            await createPalletsAndPutawayLines(ctx.db, {
                transactionType: 'WIP_COMPLETION',
                documentId: existing.id,
                items: existing.items.map((item) => ({
                    itemId: item.id,
                    skuId: item.skuId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.wipCompletion.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeWipCompletion,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'wip_completion',
                resourceId: approved.id,
                message: `Menyetujui WIP completion ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('wip-completion@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipCompletion.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'wipCompletion.notFound'));

            const rejected = await ctx.db.wipCompletion.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'wip_completion',
                resourceId: rejected.id,
                message: `Menolak WIP completion ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
