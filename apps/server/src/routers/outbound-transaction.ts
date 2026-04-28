import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from "../lib/log-detail.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import {
    buildApprovalActionData,
    buildTransactionBaseWhere,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    ensureDraftOrRejected,
    ensureNoDuplicatePalletIds,
    normalizeText,
    approvalHistorySchema,
    transactionApprovalStatusSchema,
    transactionListInputSchema,
} from "../lib/transaction.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const outboundTransactionItemInputSchema = z.object({
    skuId: z.string().min(1, "SKU is required"),
    palletTypeId: z.string().min(1, "Pallet type is required"),
    details: z.string().optional(),
    palletIds: z.array(z.string().min(1, "Pallet ID is required")).min(1, "At least one pallet is required"),
});

const outboundTransactionInputSchema = z.object({
    id: z.string().optional(),
    date: z.coerce.date().optional(),
    recipient: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(outboundTransactionItemInputSchema).min(1, "At least one item is required"),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    message: z.string().optional(),
    approvalHistory: approvalHistorySchema,
});

const outboundTransactionEditableStatusSchema = z.enum(["DRAFT", "PROPOSED"] as const);

const includeOutboundTransaction = {
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            sku: true,
            palletType: true,
            pallets: {
                select: {
                    id: true,
                    status: true,
                    palletType: {
                        select: { name: true },
                    },
                },
            },
        },
    },
} as const;

const summarizeOutboundTransaction = <T extends { items: Array<{ quantity: number; pallets: Array<unknown> }> }>(
    row: T,
) => ({
    ...row,
    totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
    totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
});

export const outboundTransactionRouter = router({
    formSkuOptions: protectedProcedure
        .use(hasPermission(['outbound_transaction@read', 'outbound_transaction@create', 'outbound_transaction@update']))
        .input(z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
        .query(async ({ ctx, input }) => {
            const search = input?.search?.trim();

            const where = search
                ? {
                      OR: [
                          { id: { contains: search, mode: 'insensitive' as const } },
                          { name: { contains: search, mode: 'insensitive' as const } },
                          { palletTypes: { some: { id: { contains: search, mode: 'insensitive' as const } } } },
                          { palletTypes: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
                      ],
                  }
                : {};

            const rows = await ctx.db.sku.findMany({
                where,
                orderBy: { name: 'asc' },
                take: input?.limit ?? 200,
                include: {
                    palletTypes: {
                        select: {
                            id: true,
                            name: true,
                            skuId: true,
                        },
                        orderBy: { name: 'asc' },
                    },
                },
            });

            return { data: rows };
        }),

    availablePallets: protectedProcedure
        .use(hasPermission(['outbound_transaction@read', 'outbound_transaction@create', 'outbound_transaction@update']))
        .input(
            z.object({
                palletTypeId: z.string().min(1),
                search: z.string().optional(),
                limit: z.number().int().min(1).max(200).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const search = input.search?.trim();

            const rows = await ctx.db.pallet.findMany({
                where: {
                    status: 'AVAILABLE',
                    palletTypeId: input.palletTypeId,
                    ...(search
                        ? {
                              OR: [
                                  { id: { contains: search, mode: 'insensitive' as const } },
                                  { palletType: { name: { contains: search, mode: 'insensitive' as const } } },
                                  { palletType: { sku: { id: { contains: search, mode: 'insensitive' as const } } } },
                                  { palletType: { sku: { name: { contains: search, mode: 'insensitive' as const } } } },
                              ],
                          }
                        : {}),
                },
                take: input.limit ?? 50,
                orderBy: { createdAt: 'desc' },
                include: {
                    palletType: {
                        include: {
                            sku: {
                                select: { id: true, name: true },
                            },
                        },
                    },
                },
            });

            return { data: rows };
        }),

    list: protectedProcedure.use(hasPermission('outbound_transaction@read')).input(transactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { recipient: { contains: search, mode: "insensitive" as const } },
                          { reference: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { createdBy: { name: { contains: search, mode: "insensitive" as const } } },
                          { createdBy: { email: { contains: search, mode: "insensitive" as const } } },
                      ],
                  }
                : {}),
        };

        const rows = await ctx.db.outboundTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: "desc" },
            include: includeOutboundTransaction,
        });
        const total = await ctx.db.outboundTransaction.count({ where });

        return { data: rows.map(summarizeOutboundTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('outbound_transaction@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.outboundTransaction.findUnique({
            where: { id: input.id },
            include: includeOutboundTransaction,
        });

        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
        }

        return row;
    }),

    create: protectedProcedure.use(hasPermission('outbound_transaction@create')).use(transactional).input(outboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        const itemPalletIds = input.items.flatMap((item) => item.palletIds);
        ensureNoDuplicatePalletIds(itemPalletIds, ctx.locale, 'outboundTransaction.duplicatePalletIds');

        const pallets = await ctx.db.pallet.findMany({
            where: { id: { in: itemPalletIds } },
            include: {
                palletType: { select: { id: true, skuId: true } },
            },
        });

        if (pallets.length !== itemPalletIds.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsNotFound') });
        }

        const invalidPallet = pallets.find((pallet) => pallet.status !== 'AVAILABLE');
        if (invalidPallet) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsInvalid') });
        }

        for (const item of input.items) {
            for (const palletId of item.palletIds) {
                const pallet = pallets.find((palletRow) => palletRow.id === palletId);
                if (!pallet || pallet.palletTypeId !== item.palletTypeId || pallet.palletType.skuId !== item.skuId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsInvalid') });
                }
            }
        }

        const approvalHistory = input.approvalStatus === 'PROPOSED'
            ? buildApprovalActionData(input.approvalHistory ?? [], ctx.user!, 'PROPOSED', input.message).approvalHistory
            : input.approvalHistory ?? [];

        const created = await ctx.db.outboundTransaction.create({
            data: {
                id: input.id || undefined,
                date: input.date ?? new Date(),
                recipient: normalizeText(input.recipient),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory,
                approvalStatus: input.approvalStatus ?? 'DRAFT',
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        palletTypeId: item.palletTypeId,
                        quantity: item.palletIds.length,
                        details: normalizeText(item.details),
                        pallets: {
                            connect: item.palletIds.map((palletId) => ({ id: palletId })),
                        },
                    })),
                },
            },
            include: includeOutboundTransaction,
        });

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user!.userId,
            resource: 'transaksi_pengeluaran',
            resourceId: created.id,
            message: `Membuat transaksi keluar ${created.id}`,
            detail: buildCreateLogDetail(created),
        });

        return created;
    }),

    update: protectedProcedure.use(hasPermission('outbound_transaction@update')).use(transactional)
        .input(outboundTransactionInputSchema.extend({ id: z.string(), approvalStatus: outboundTransactionEditableStatusSchema }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    date: true,
                    recipient: true,
                    reference: true,
                    notes: true,
                    approvalStatus: true,
                    approvalHistory: true,
                    createdAt: true,
                    updatedAt: true,
                    createdById: true,
                    approvedById: true,
                    approvedAt: true,
                },
            });

            ensureDraftOrRejected(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            const itemPalletIds = input.items.flatMap((item) => item.palletIds);
            ensureNoDuplicatePalletIds(itemPalletIds, ctx.locale, 'outboundTransaction.duplicatePalletIds');

            const pallets = await ctx.db.pallet.findMany({
                where: { id: { in: itemPalletIds } },
                include: {
                    palletType: { select: { id: true, skuId: true } },
                },
            });

            if (pallets.length !== itemPalletIds.length) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsNotFound') });
            }

            const invalidPallet = pallets.find((pallet) => pallet.status !== 'AVAILABLE');
            if (invalidPallet) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsInvalid') });
            }

            for (const item of input.items) {
                for (const palletId of item.palletIds) {
                    const pallet = pallets.find((palletRow) => palletRow.id === palletId);
                    if (!pallet || pallet.palletTypeId !== item.palletTypeId || pallet.palletType.skuId !== item.skuId) {
                        throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.palletsInvalid') });
                    }
                }
            }

            const updatedApprovalHistory = input.approvalHistory ?? existing?.approvalHistory ?? [];
            const approvalHistory = input.approvalStatus === 'PROPOSED'
                ? buildApprovalActionData(updatedApprovalHistory, ctx.user!, 'PROPOSED', input.message).approvalHistory
                : updatedApprovalHistory;

            const updated = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: {
                    id: input.id || undefined,
                    date: input.date ?? new Date(),
                    recipient: normalizeText(input.recipient),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    approvalHistory,
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.palletIds.length,
                            details: normalizeText(item.details),
                            pallets: {
                                connect: item.palletIds.map((palletId) => ({ id: palletId })),
                            },
                        })),
                    },
                },
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'transaksi_pengeluaran',
                resourceId: updated.id,
                message: `Memperbarui transaksi keluar ${updated.id}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('outbound_transaction@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.outboundTransaction.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!before) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
        }

        ensureDraftOrRejected(before.approvalStatus, getMessage(ctx.locale, 'outboundTransaction.notFound'));

        await ctx.db.outboundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: 'DELETE',
            userId: ctx.user!.userId,
            resource: 'transaksi_pengeluaran',
            resourceId: before.id,
            message: `Menghapus transaksi keluar ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('outbound_transaction@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            pallets: {
                                select: { id: true },
                            },
                        },
                    },
                },
            });

            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            const palletIds = existing?.items.flatMap((item) => item.pallets.map((pallet) => pallet.id)) ?? [];
            if (!existing || palletIds.length === 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.emptyPallets') });
            }

            await ctx.db.pallet.updateMany({
                where: { id: { in: palletIds } },
                data: { status: 'NOT_AVAILABLE' },
            });

            const approved = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message),
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: 'APPROVE',
                userId: ctx.user!.userId,
                resource: 'transaksi_pengeluaran',
                resourceId: approved.id,
                message: `Menyetujui transaksi keluar ${approved.id}`,
                detail: {
                    before: {
                        approvalStatus: existing.approvalStatus,
                        approvalHistory: existing.approvalHistory,
                    },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    propose: protectedProcedure.use(hasPermission('outbound_transaction@update'))
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                select: { id: true, approvalStatus: true, approvalHistory: true },
            });

            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
            }

            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'outboundTransaction.notFound'));

            const proposedApproval = buildApprovalActionData(existing.approvalHistory, ctx.user!, 'PROPOSED', input.message);
            const proposed = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: {
                    approvalStatus: 'PROPOSED',
                    approvalHistory: proposedApproval.approvalHistory,
                },
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'transaksi_pengeluaran',
                resourceId: proposed.id,
                message: `Mengajukan transaksi keluar ${proposed.id} untuk persetujuan`,
                detail: { before: { approvalStatus: existing.approvalStatus }, after: { approvalStatus: proposed.approvalStatus } },
            });

            return proposed;
        }),

    reject: protectedProcedure.use(hasPermission('outbound_transaction@approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                select: {
                    approvalStatus: true,
                    approvalHistory: true,
                    items: {
                        select: {
                            pallets: {
                                select: { id: true },
                            },
                        },
                    },
                },
            });

            if (!existing || (existing.approvalStatus !== 'PROPOSED' && existing.approvalStatus !== 'APPROVED')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'outboundTransaction.notFound') });
            }

            if (existing.approvalStatus === 'APPROVED') {
                const palletIds = existing.items.flatMap((item) => item.pallets.map((pallet) => pallet.id));
                await ctx.db.pallet.updateMany({
                    where: { id: { in: palletIds } },
                    data: { status: 'AVAILABLE' },
                });
            }

            const rejected = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'transaksi_pengeluaran',
                resourceId: rejected.id,
                message: `Menolak transaksi keluar ${rejected.id}`,
            });

            return rejected;
        }),
});
