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
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    rmaReceiptListInputSchema,
    createRmaReceiptSchema,
} from "@repo/schemas/rma-receipt";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const includeRmaReceipt = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true } },
    originalShipment: { select: { id: true } },
    items: {
        include: {
            sku: true,
            palletType: true,
        },
    },
} as const;

export const rmaReceiptRouter = router({
    list: protectedProcedure.use(hasPermission('rma-receipt@read')).input(rmaReceiptListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(input?.originalShipmentId ? { originalShipmentId: input.originalShipmentId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { salesOrderRef: { contains: search, mode: 'insensitive' as const } },
                    { returnReason: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.rmaReceipt.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: includeRmaReceipt,
        });
        const total = await ctx.db.rmaReceipt.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('rma-receipt@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.rmaReceipt.findUnique({ where: { id: input.id }, include: includeRmaReceipt });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'rmaReceipt.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('rma-receipt@create')).use(transactional).input(createRmaReceiptSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'rmaReceipt.duplicateItem');
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: 'rmaReceipt.palletTypeNotFound',
            palletTypeMismatch: 'rmaReceipt.palletTypeMismatch',
        });

        const created = await ctx.db.rmaReceipt.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber: normalizeText(input.documentNumber),
                originalShipmentId: input.originalShipmentId ?? null,
                salesOrderRef: normalizeText(input.salesOrderRef),
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
                        palletTypeId: item.palletTypeId,
                        quantity: item.quantity,
                        details: normalizeText(item.details),
                    })),
                },
            },
            include: includeRmaReceipt,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'rma_receipt',
            resourceId: created.id,
            message: `Membuat RMA receipt ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('rma-receipt@update')).use(transactional)
        .input(createRmaReceiptSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.rmaReceipt.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, originalShipmentId: true, salesOrderRef: true,
                    returnReason: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'rmaReceipt.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'rmaReceipt.cannotUpdate'));

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'RMA_RECEIPT' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'rmaReceipt.cannotUpdateGeneratedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'rmaReceipt.duplicateItem');
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: 'rmaReceipt.palletTypeNotFound',
                palletTypeMismatch: 'rmaReceipt.palletTypeMismatch',
            });

            const updated = await ctx.db.rmaReceipt.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber: normalizeText(input.documentNumber),
                    originalShipmentId: input.originalShipmentId ?? null,
                    salesOrderRef: normalizeText(input.salesOrderRef),
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
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                            details: normalizeText(item.details),
                        })),
                    },
                },
                include: includeRmaReceipt,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'rma_receipt',
                resourceId: updated.id,
                message: `Memperbarui RMA receipt ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('rma-receipt@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.rmaReceipt.findUnique({ where: { id: input.id }, include: includeRmaReceipt });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'rmaReceipt.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'rmaReceipt.cannotDelete'));

        const generatedCount = await ctx.db.putawayLine.count({
            where: { documentId: input.id, transactionType: 'RMA_RECEIPT' },
        });
        if (generatedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'rmaReceipt.cannotDeleteGeneratedPallets') });
        }

        await ctx.db.rmaReceipt.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'rma_receipt',
            resourceId: before.id,
            message: `Menghapus RMA receipt ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('rma-receipt@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.rmaReceipt.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true, palletType: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'rmaReceipt.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'rmaReceipt.emptyItems') });
            }

            const generatedCount = await ctx.db.putawayLine.count({
                where: { documentId: input.id, transactionType: 'RMA_RECEIPT' },
            });
            if (generatedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'rmaReceipt.alreadyGenerated') });
            }

            await createPalletsAndPutawayLines(ctx.db, {
                transactionType: 'RMA_RECEIPT',
                documentId: existing.id,
                items: existing.items.map((item) => ({
                    itemId: item.id,
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.rmaReceipt.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeRmaReceipt,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'rma_receipt',
                resourceId: approved.id,
                message: `Menyetujui RMA receipt ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('rma-receipt@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.rmaReceipt.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'rmaReceipt.notFound'));

            const rejected = await ctx.db.rmaReceipt.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'rma_receipt',
                resourceId: rejected.id,
                message: `Menolak RMA receipt ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
