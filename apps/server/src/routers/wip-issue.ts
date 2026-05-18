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
    reservePalletsAndCreatePickLines,
    writeStockMovements,
} from "../lib/transaction.js";
import { approvalStatusValues } from "@repo/schemas/transaction-common";
import {
    wipIssueListInputSchema,
    createWipIssueSchema,
} from "@repo/schemas/wip-issue";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const includeWipIssue = {
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

export const wipIssueRouter = router({
    list: protectedProcedure.use(hasPermission('wip-issue@read')).input(wipIssueListInputSchema).query(async ({ ctx, input }) => {
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
                    { workOrderRef: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.wipIssue.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: includeWipIssue,
        });
        const total = await ctx.db.wipIssue.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('wip-issue@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.wipIssue.findUnique({ where: { id: input.id }, include: includeWipIssue });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipIssue.notFound') });
        }
        return summarizeItemTransaction(row);
    }),

    create: protectedProcedure.use(hasPermission('wip-issue@create')).use(transactional).input(createWipIssueSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'wipIssue.duplicateItem');
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: 'wipIssue.palletTypeNotFound',
            palletTypeMismatch: 'wipIssue.palletTypeMismatch',
        });

        const created = await ctx.db.wipIssue.create({
            data: {
                date: input.date ?? new Date(),
                workOrderRef: normalizeText(input.workOrderRef),
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
            include: includeWipIssue,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'wip_issue',
            resourceId: created.id,
            message: `Membuat WIP issue ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('wip-issue@update')).use(transactional)
        .input(createWipIssueSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipIssue.findUnique({
                where: { id: input.id },
                select: {
                    id: true, approvalStatus: true, approvalHistory: true,
                    date: true, workOrderRef: true, reference: true, notes: true,
                    warehouseId: true, createdById: true, approvedById: true, approvedAt: true,
                },
            });
            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipIssue.notFound') });
            }
            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'wipIssue.cannotUpdate'));

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, 'wipIssue.duplicateItem');
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: 'wipIssue.palletTypeNotFound',
                palletTypeMismatch: 'wipIssue.palletTypeMismatch',
            });

            const updated = await ctx.db.wipIssue.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    workOrderRef: normalizeText(input.workOrderRef),
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
                include: includeWipIssue,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'wip_issue',
                resourceId: updated.id,
                message: `Memperbarui WIP issue ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('wip-issue@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.wipIssue.findUnique({ where: { id: input.id }, include: includeWipIssue });
        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'wipIssue.notFound') });
        }
        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'wipIssue.cannotDelete'));

        await ctx.db.wipIssue.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'wip_issue',
            resourceId: before.id,
            message: `Menghapus WIP issue ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('wip-issue@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipIssue.findUnique({
                where: { id: input.id },
                include: { items: { include: { sku: true, palletType: true } } },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'wipIssue.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'wipIssue.emptyItems') });
            }

            // Reserve available pallets (FIFO) + create PickLines
            await reservePalletsAndCreatePickLines(ctx.db, {
                transactionType: 'WIP_ISSUE',
                documentId: existing.id,
                warehouseId: existing.warehouseId,
                items: existing.items.map((item) => ({
                    palletTypeId: item.palletTypeId,
                    quantity: item.quantity,
                })),
            });

            // Write stock movements (direction OUT)
            await writeStockMovements(ctx.db, {
                transactionType: 'WIP_ISSUE',
                direction: 'OUT',
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

            const approved = await ctx.db.wipIssue.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeWipIssue,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'wip_issue',
                resourceId: approved.id,
                message: `Menyetujui WIP issue ${approved.id}`,
                detail: {
                    before: { approvalStatus: existing.approvalStatus, approvalHistory: existing.approvalHistory },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: protectedProcedure.use(hasPermission('wip-issue@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.wipIssue.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'wipIssue.notFound'));

            const rejected = await ctx.db.wipIssue.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'wip_issue',
                resourceId: rejected.id,
                message: `Menolak WIP issue ${rejected.id}`,
                detail: {
                    before: { approvalStatus: existing?.approvalStatus ?? null },
                    approvalMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
