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
import { getNextDocumentNumber } from "../lib/document-number.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    shipmentListInputSchema,
    createShipmentSchema,
} from "@repo/schemas/shipment";
import { buildPaginationMeta, buildPaginationParams, buildSortParams } from "../lib/list-query.js";

const includeShipment = {
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
const SHIPMENT_SORTABLE_FIELDS: Record<string, (order: 'asc' | 'desc') => Record<string, unknown>> = {
    documentNumber: (order) => ({ documentNumber: order }),
    date: (order) => ({ date: order }),
    approvalStatus: (order) => ({ approvalStatus: order }),
    recipient: (order) => ({ recipient: order }),
};

const buildShipmentOrderBy = (input?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const sort = buildSortParams(input);
    if (sort) {
        const builder = SHIPMENT_SORTABLE_FIELDS[sort.sortBy];
        if (builder) return builder(sort.sortOrder);
    }
    return { date: 'desc' as const };
};

export const shipmentRouter = router({
    list: protectedProcedure.use(hasPermission('shipment@read')).input(shipmentListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(input?.dispatchOpenStatus ? { dispatchOpenStatus: input.dispatchOpenStatus } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                    { shipmentNumber: { contains: search, mode: 'insensitive' as const } },
                    { salesOrderRef: { contains: search, mode: 'insensitive' as const } },
                    { recipient: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.shipment.findMany({
            where,
            skip,
            take: limit,
            orderBy: buildShipmentOrderBy(input),
            include: includeShipment,
        });
        const total = await ctx.db.shipment.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('shipment@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.shipment.findUnique({ where: { id: input.id }, include: includeShipment });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'shipment.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('shipment@create')).use(transactional).input(createShipmentSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'shipment.duplicateItem');
        const documentNumber = normalizeText(input.documentNumber) ?? await getNextDocumentNumber(ctx.db, {
            transactionType: 'SHIPMENT',
            warehouseId: input.warehouseId,
            date: input.date ?? new Date(),
        });

        const created = await ctx.db.shipment.create({
            data: {
                date: input.date ?? new Date(),
                documentNumber,
                shipmentNumber: normalizeText(input.shipmentNumber),
                salesOrderRef: normalizeText(input.salesOrderRef),
                recipient: normalizeText(input.recipient),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                carrier: normalizeText(input.carrier),
                trackingNumber: normalizeText(input.trackingNumber),
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
            include: includeShipment,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'shipment',
            resourceId: created.id,
            message: `Membuat shipment ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('shipment@update')).use(transactional)
        .input(createShipmentSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.shipment.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, documentNumber: true, shipmentNumber: true, salesOrderRef: true,
                    recipient: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'shipment.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'shipment.cannotUpdate'));

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'SHIPMENT' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'shipment.cannotUpdateReservedPallets') });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'shipment.duplicateItem');
    

            const documentNumber = normalizeText(input.documentNumber) ?? existing.documentNumber;

            const updated = await ctx.db.shipment.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    documentNumber,
                    shipmentNumber: normalizeText(input.shipmentNumber),
                    salesOrderRef: normalizeText(input.salesOrderRef),
                    recipient: normalizeText(input.recipient),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    carrier: normalizeText(input.carrier),
                    trackingNumber: normalizeText(input.trackingNumber),
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
                include: includeShipment,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'shipment',
                resourceId: updated.id,
                message: `Memperbarui shipment ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('shipment@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.shipment.findUnique({ where: { id: input.id }, include: includeShipment });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'shipment.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'shipment.cannotDelete'));

        const reservedCount = await ctx.db.pickLine.count({
            where: { documentId: input.id, transactionType: 'SHIPMENT' },
        });
        if (reservedCount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'shipment.cannotDeleteReservedPallets') });
        }

        await ctx.db.shipment.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'shipment',
            resourceId: before.id,
            message: `Menghapus shipment ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('shipment@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.shipment.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'shipment.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'shipment.emptyItems') });
            }

            const reservedCount = await ctx.db.pickLine.count({
                where: { documentId: input.id, transactionType: 'SHIPMENT' },
            });
            if (reservedCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'shipment.alreadyReserved') });
            }

            await reservePalletsAndCreatePickLines(ctx.db, ctx.locale, {
                transactionType: 'SHIPMENT',
                documentId: existing.id,
                warehouseId: existing.warehouseId,
                items: existing.items.map((item) => ({
                    skuId: item.skuId,
                    quantity: item.quantity,
                })),
            });

            const approved = await ctx.db.shipment.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeShipment,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'shipment',
                resourceId: approved.id,
                message: `Menyetujui shipment ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('shipment@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.shipment.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'shipment.notFound'));

            const rejected = await ctx.db.shipment.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'shipment',
                resourceId: rejected.id,
                message: `Menolak shipment ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
