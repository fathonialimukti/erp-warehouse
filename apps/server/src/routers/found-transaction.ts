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
    ensureTransactionPalletTypesMatchSku,
    normalizeText,
    summarizeItemTransaction,
    createPalletsAndPutawayLines,
    writeStockMovements,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    foundTransactionListInputSchema,
    createFoundTransactionSchema,
} from "@repo/schemas/transaction-found";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const includeFoundTransaction = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true, code: true } },
    items: {
        include: {
            sku: true,
            palletType: true,
        },
    },
} as const;

export const foundTransactionRouter = router({
    list: protectedProcedure.use(hasPermission('found@read')).input(foundTransactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                    { foundReason: { contains: search, mode: 'insensitive' as const } },
                    { foundLocation: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.foundTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: includeFoundTransaction,
        });
        const total = await ctx.db.foundTransaction.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('found@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.foundTransaction.findUnique({
            where: { id: input.id },
            include: includeFoundTransaction,
        });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'foundTransaction.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('found@create')).use(transactional).input(createFoundTransactionSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'foundTransaction.duplicateItem');
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: 'foundTransaction.palletTypeNotFound',
            palletTypeMismatch: 'foundTransaction.palletTypeMismatch',
        });

        const created = await ctx.db.foundTransaction.create({
            data: {
                date: input.date ?? new Date(),
                foundReason: normalizeText(input.foundReason),
                foundLocation: normalizeText(input.foundLocation),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                warehouseId: input.warehouseId,
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? 'DRAFT',
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        palletTypeId: item.palletTypeId,
                        quantity: item.quantity,
                        details: normalizeText(item.details),
                    })),
                },
            },
            include: includeFoundTransaction,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'found_transaction',
            resourceId: created.id,
            message: `Membuat transaksi temuan ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('found@update')).use(transactional)
        .input(createFoundTransactionSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, foundReason: true, foundLocation: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'foundTransaction.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'foundTransaction.cannotUpdate'));

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'FOUND' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'foundTransaction.cannotUpdateGeneratedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'foundTransaction.duplicateItem');
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: 'foundTransaction.palletTypeNotFound',
                palletTypeMismatch: 'foundTransaction.palletTypeMismatch',
            });

            const updated = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    foundReason: normalizeText(input.foundReason),
                    foundLocation: normalizeText(input.foundLocation),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    warehouseId: input.warehouseId,
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                            details: normalizeText(item.details),
                        })),
                    },
                },
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'found_transaction',
                resourceId: updated.id,
                message: `Memperbarui transaksi temuan ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('found@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.foundTransaction.findUnique({
            where: { id: input.id },
            include: includeFoundTransaction,
        });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'foundTransaction.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'foundTransaction.cannotDelete'));

        const generatedCount = await ctx.db.putawayLine.count({
            where: { documentId: input.id, transactionType: 'FOUND' },
        });
        if (generatedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'foundTransaction.cannotDeleteGeneratedPallets') });
        }

        await ctx.db.foundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'found_transaction',
            resourceId: before.id,
            message: `Menghapus transaksi temuan ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('found@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true, palletType: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'foundTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'foundTransaction.emptyItems') });
            }

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'FOUND' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'foundTransaction.alreadyGenerated') });
            }

            await createPalletsAndPutawayLines(ctx.db, {
                transactionType: 'FOUND',
                documentId: existing.id,
                items: existing.items.map((item) => ({
                    itemId: item.id,
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            await writeStockMovements(ctx.db, {
                transactionType: 'FOUND',
                direction: 'IN',
                documentId: existing.id,
                documentNumber: existing.reference,
                warehouseId: existing.warehouseId,
                transactionDate: existing.date,
                postedById: ctx.user!.userId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'found_transaction',
                resourceId: approved.id,
                message: `Menyetujui transaksi temuan ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('found@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'foundTransaction.notFound'));

            const rejected = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'found_transaction',
                resourceId: rejected.id,
                message: `Menolak transaksi temuan ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
