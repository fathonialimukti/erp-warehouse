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
import {
    returnToSupplierListInputSchema,
    createReturnToSupplierSchema,
} from "@repo/schemas/return-to-supplier";
import { buildPaginationMeta, buildPaginationParams, buildSortParams } from "../lib/list-query.js";

const includeReturnToSupplier = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true, code: true } },
    originalReceiving: { select: { id: true } },
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
const RETURN_TO_SUPPLIER_SORTABLE_FIELDS: Record<string, (order: 'asc' | 'desc') => Record<string, unknown>> = {
    documentNumber: (order) => ({ documentNumber: order }),
    date: (order) => ({ date: order }),
    approvalStatus: (order) => ({ approvalStatus: order }),
    supplier: (order) => ({ supplier: { name: order } }),
};

const buildReturnToSupplierOrderBy = (input?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const sort = buildSortParams(input);
    if (sort) {
        const builder = RETURN_TO_SUPPLIER_SORTABLE_FIELDS[sort.sortBy];
        if (builder) return builder(sort.sortOrder);
    }
    return { date: 'desc' as const };
};

export const returnToSupplierRouter = router({
    list: protectedProcedure.use(hasPermission('return-to-supplier@read')).input(returnToSupplierListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(input?.supplierId ? { supplierId: input.supplierId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { returnReason: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.returnToSupplier.findMany({
            where,
            skip,
            take: limit,
            orderBy: buildReturnToSupplierOrderBy(input),
            include: includeReturnToSupplier,
        });
        const total = await ctx.db.returnToSupplier.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('return-to-supplier@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.returnToSupplier.findUnique({ where: { id: input.id }, include: includeReturnToSupplier });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'returnToSupplier.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('return-to-supplier@create')).use(transactional).input(createReturnToSupplierSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'returnToSupplier.duplicateItem');
        const created = await ctx.db.returnToSupplier.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber: normalizeText(input.documentNumber),
                supplierId: input.supplierId,
                originalReceivingId: input.originalReceivingId ?? null,
                returnReason: normalizeText(input.returnReason),
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
            include: includeReturnToSupplier,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'return_to_supplier',
            resourceId: created.id,
            message: `Membuat return to supplier ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('return-to-supplier@update')).use(transactional)
        .input(createReturnToSupplierSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.returnToSupplier.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, supplierId: true, originalReceivingId: true,
                    returnReason: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'returnToSupplier.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'returnToSupplier.cannotUpdate'));

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'RETURN_TO_SUPPLIER' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'returnToSupplier.cannotUpdateReservedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'returnToSupplier.duplicateItem');
    

            const updated = await ctx.db.returnToSupplier.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber: normalizeText(input.documentNumber),
                    supplierId: input.supplierId,
                    originalReceivingId: input.originalReceivingId ?? null,
                    returnReason: normalizeText(input.returnReason),
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
                include: includeReturnToSupplier,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'return_to_supplier',
                resourceId: updated.id,
                message: `Memperbarui return to supplier ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('return-to-supplier@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.returnToSupplier.findUnique({ where: { id: input.id }, include: includeReturnToSupplier });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'returnToSupplier.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'returnToSupplier.cannotDelete'));

        const reservedCount = await ctx.db.pickLine.count({
            where: { documentId: input.id, transactionType: 'RETURN_TO_SUPPLIER' },
        });
        if (reservedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'returnToSupplier.cannotDeleteReservedPallets') });
        }

        await ctx.db.returnToSupplier.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'return_to_supplier',
            resourceId: before.id,
            message: `Menghapus return to supplier ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('return-to-supplier@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.returnToSupplier.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'returnToSupplier.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'returnToSupplier.emptyItems') });
            }

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'RETURN_TO_SUPPLIER' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'returnToSupplier.alreadyReserved') });
            }

            await reservePalletsAndCreatePickLines(ctx.db, ctx.locale, {
                transactionType: 'RETURN_TO_SUPPLIER',
                documentId: existing.id,
                warehouseId: existing.warehouseId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.returnToSupplier.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeReturnToSupplier,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'return_to_supplier',
                resourceId: approved.id,
                message: `Menyetujui return to supplier ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('return-to-supplier@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.returnToSupplier.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'returnToSupplier.notFound'));

            const rejected = await ctx.db.returnToSupplier.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'return_to_supplier',
                resourceId: rejected.id,
                message: `Menolak return to supplier ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
