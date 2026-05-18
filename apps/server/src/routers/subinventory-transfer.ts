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
    normalizeText,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    subinventoryTransferListInputSchema,
    createSubinventoryTransferSchema,
} from "@repo/schemas/subinventory-transfer";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const includeSubinventoryTransfer = {
    createdBy: true,
    approvedBy: true,
    warehouse: { select: { id: true, name: true, code: true } },
    items: {
        include: {
            pallet: {
                include: {
                    palletType: true,
                },
            },
            fromLocation: { select: { id: true, warehouseId: true } },
            toLocation: { select: { id: true, warehouseId: true } },
        },
    },
} as const;

export const subinventoryTransferRouter = router({
    list: protectedProcedure.use(hasPermission('subinventory-transfer@read')).input(subinventoryTransferListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search, mode: 'insensitive' as const } },
                    { transferReason: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                    { notes: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.subinventoryTransfer.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: includeSubinventoryTransfer,
        });
        const total = await ctx.db.subinventoryTransfer.count({ where });

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('subinventory-transfer@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.subinventoryTransfer.findUnique({ where: { id: input.id }, include: includeSubinventoryTransfer });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'subinventoryTransfer.notFound') });
        }
        return row;
    }),

    create: protectedProcedure.use(hasPermission('subinventory-transfer@create')).use(transactional).input(createSubinventoryTransferSchema).mutation(async ({ ctx, input }) => {
        // Validate all pallets exist and belong to the specified warehouse
        const palletIds = input.items.map((i) => i.palletId);
        const pallets = await ctx.db.pallet.findMany({
            where: { id: { in: palletIds } },
            select: { id: true, status: true, storageLocationId: true },
        });

        if (pallets.length !== palletIds.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'subinventoryTransfer.palletNotFound') });
        }

        const notAvailable = pallets.filter((p) => p.status !== 'AVAILABLE');
        if (notAvailable.length > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'subinventoryTransfer.palletNotAvailable') });
        }

        const created = await ctx.db.subinventoryTransfer.create({
            data: {
                date: input.date ?? new Date(),
                transferReason: normalizeText(input.transferReason),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                warehouseId: input.warehouseId,
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? 'DRAFT',
                items: {
                    create: input.items.map((item) => ({
                        palletId: item.palletId,
                        fromLocationId: item.fromLocationId,
                        toLocationId: item.toLocationId,
                    })),
                },
            },
            include: includeSubinventoryTransfer,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'subinventory_transfer',
            resourceId: created.id,
            message: `Membuat subinventory transfer ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('subinventory-transfer@update')).use(transactional)
        .input(createSubinventoryTransferSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.subinventoryTransfer.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, transferReason: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'subinventoryTransfer.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'subinventoryTransfer.cannotUpdate'));

            const palletIds = input.items.map((i) => i.palletId);
            const pallets = await ctx.db.pallet.findMany({
                where: { id: { in: palletIds } },
                select: { id: true, status: true },
            });

            if (pallets.length !== palletIds.length) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'subinventoryTransfer.palletNotFound') });
            }

            const notAvailable = pallets.filter((p) => p.status !== 'AVAILABLE');
            if (notAvailable.length > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'subinventoryTransfer.palletNotAvailable') });
            }

            const updated = await ctx.db.subinventoryTransfer.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    transferReason: normalizeText(input.transferReason),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    warehouseId: input.warehouseId,
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            palletId: item.palletId,
                            fromLocationId: item.fromLocationId,
                            toLocationId: item.toLocationId,
                        })),
                    },
                },
                include: includeSubinventoryTransfer,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'subinventory_transfer',
                resourceId: updated.id,
                message: `Memperbarui subinventory transfer ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('subinventory-transfer@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.subinventoryTransfer.findUnique({ where: { id: input.id }, include: includeSubinventoryTransfer });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'subinventoryTransfer.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'subinventoryTransfer.cannotDelete'));

        await ctx.db.subinventoryTransfer.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'subinventory_transfer',
            resourceId: before.id,
            message: `Menghapus subinventory transfer ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('subinventory-transfer@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.subinventoryTransfer.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallet: { select: { id: true, status: true, storageLocationId: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'subinventoryTransfer.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'subinventoryTransfer.emptyItems') });
            }

            // Move each pallet to its target location
            for (const item of existing.items) {
                await ctx.db.pallet.update({
                    where: { id: item.palletId },
                    data: { storageLocationId: item.toLocationId },
                });
            }

            const approved = await ctx.db.subinventoryTransfer.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeSubinventoryTransfer,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'subinventory_transfer',
                resourceId: approved.id,
                message: `Menyetujui subinventory transfer ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('subinventory-transfer@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.subinventoryTransfer.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'subinventoryTransfer.notFound'));

            const rejected = await ctx.db.subinventoryTransfer.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'subinventory_transfer',
                resourceId: rejected.id,
                message: `Menolak subinventory transfer ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
