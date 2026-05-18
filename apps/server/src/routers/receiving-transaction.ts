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
    receivingTransactionListInputSchema,
    createReceivingTransactionSchema,
} from "@repo/schemas/receiving-transaction";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const includeReceiving = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true, code: true } },
    supplier: { select: { id: true, name: true, code: true } },
    items: {
        include: {
            sku: true,
            palletType: true,
        },
    },
} as const;

export const receivingTransactionRouter = router({
    list: protectedProcedure.use(hasPermission('receiving@read')).input(receivingTransactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(input?.supplierId ? { supplierId: input.supplierId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { purchaseOrderRef: { contains: search, mode: 'insensitive' as const } },
                    { deliveryNoteRef: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.receivingTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: includeReceiving,
        });
        const total = await ctx.db.receivingTransaction.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('receiving@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.receivingTransaction.findUnique({ where: { id: input.id }, include: includeReceiving });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'receivingTransaction.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('receiving@create')).use(transactional).input(createReceivingTransactionSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'receivingTransaction.duplicateItem');
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: 'receivingTransaction.palletTypeNotFound',
            palletTypeMismatch: 'receivingTransaction.palletTypeMismatch',
        });

        const created = await ctx.db.receivingTransaction.create({
            data: {
                date: input.date ?? new Date(),
                supplierId: input.supplierId,
                purchaseOrderRef: normalizeText(input.purchaseOrderRef),
                deliveryNoteRef: normalizeText(input.deliveryNoteRef),
                carrier: normalizeText(input.carrier),
                trackingNumber: normalizeText(input.trackingNumber),
                driverName: normalizeText(input.driverName),
                driverContact: normalizeText(input.driverContact),
                vehiclePlate: normalizeText(input.vehiclePlate),
                files: input.files ?? [],
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
            include: includeReceiving,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'receiving_transaction',
            resourceId: created.id,
            message: `Membuat receiving transaction ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('receiving@update')).use(transactional)
        .input(createReceivingTransactionSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.receivingTransaction.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, supplierId: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'receivingTransaction.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'receivingTransaction.cannotUpdate'));

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'RECEIVING' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'receivingTransaction.cannotUpdateGeneratedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'receivingTransaction.duplicateItem');
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: 'receivingTransaction.palletTypeNotFound',
                palletTypeMismatch: 'receivingTransaction.palletTypeMismatch',
            });

            const updated = await ctx.db.receivingTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    supplierId: input.supplierId,
                    purchaseOrderRef: normalizeText(input.purchaseOrderRef),
                    deliveryNoteRef: normalizeText(input.deliveryNoteRef),
                    carrier: normalizeText(input.carrier),
                    trackingNumber: normalizeText(input.trackingNumber),
                    driverName: normalizeText(input.driverName),
                    driverContact: normalizeText(input.driverContact),
                    vehiclePlate: normalizeText(input.vehiclePlate),
                    files: input.files ?? [],
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
                include: includeReceiving,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'receiving_transaction',
                resourceId: updated.id,
                message: `Memperbarui receiving transaction ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('receiving@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.receivingTransaction.findUnique({ where: { id: input.id }, include: includeReceiving });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'receivingTransaction.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'receivingTransaction.cannotDelete'));

        const generatedCount = await ctx.db.putawayLine.count({
            where: { documentId: input.id, transactionType: 'RECEIVING' },
        });
        if (generatedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'receivingTransaction.cannotDeleteGeneratedPallets') });
        }

        await ctx.db.receivingTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'receiving_transaction',
            resourceId: before.id,
            message: `Menghapus receiving transaction ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('receiving@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.receivingTransaction.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true, palletType: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'receivingTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'receivingTransaction.emptyItems') });
            }

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'RECEIVING' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'receivingTransaction.alreadyGenerated') });
            }

            await createPalletsAndPutawayLines(ctx.db, {
                transactionType: 'RECEIVING',
                documentId: existing.id,
                items: existing.items.map((item) => ({
                    itemId: item.id,
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            await writeStockMovements(ctx.db, {
                transactionType: 'RECEIVING',
                direction: 'IN',
                documentId: existing.id,
                documentNumber: existing.purchaseOrderRef ?? null,
                warehouseId: existing.warehouseId,
                transactionDate: existing.date,
                postedById: ctx.user!.userId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.receivingTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeReceiving,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'receiving_transaction',
                resourceId: approved.id,
                message: `Menyetujui receiving transaction ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('receiving@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.receivingTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'receivingTransaction.notFound'));

            const rejected = await ctx.db.receivingTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'receiving_transaction',
                resourceId: rejected.id,
                message: `Menolak receiving transaction ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
