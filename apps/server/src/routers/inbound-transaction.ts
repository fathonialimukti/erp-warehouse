import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { logActivity } from "../lib/activity-log.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    buildApprovalActionData,
    buildTransactionBaseWhere,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    ensureNoDuplicateTransactionItems,
    ensureTransactionPalletTypesMatchSku,
    normalizeText,
    approvalStatusValues,
    summarizeItemTransaction,
} from "./transaction-common";
import {
    approvalHistorySchema,
    transactionApprovalStatusSchema,
    transactionListInputSchema,
} from "./transaction-schemas.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const inboundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU wajib diisi"),
    palletTypeId: z.string().min(1, "Jenis palet wajib diisi"),
    quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
    sortOrder: z.number().int().optional(),
});

const inboundTransactionInputSchema = z.object({
    id: z.string().optional(),
    date: z.coerce.date().optional(),
    sender: z.string().optional(),
    reference: z.string().optional(),
    asnNumber: z.string().optional(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    bolNumber: z.string().optional(),
    driverName: z.string().optional(),
    driverContact: z.string().optional(),
    vehiclePlate: z.string().optional(),
    files: z.array(z.any()).optional(),
    notes: z.string().optional(),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    items: z.array(inboundTransactionItemSchema).min(1, "Minimal satu item"),
    approvalHistory: approvalHistorySchema,
});

const includeInboundTransaction = {
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            sku: true,
            palletType: true,
            pallets: {
                select: {
                    id: true,
                },
            },
        },
    },
} as const;

export const inboundTransactionRouter = router({
    list: protectedProcedure.input(transactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { sender: { contains: search, mode: "insensitive" as const } },
                          { reference: { contains: search, mode: "insensitive" as const } },
                          { asnNumber: { contains: search, mode: "insensitive" as const } },
                          { carrier: { contains: search, mode: "insensitive" as const } },
                          { trackingNumber: { contains: search, mode: "insensitive" as const } },
                          { bolNumber: { contains: search, mode: "insensitive" as const } },
                          { driverName: { contains: search, mode: "insensitive" as const } },
                          { driverContact: { contains: search, mode: "insensitive" as const } },
                          { vehiclePlate: { contains: search, mode: "insensitive" as const } },
                          { createdBy: { name: { contains: search, mode: "insensitive" as const } } },
                          { createdBy: { email: { contains: search, mode: "insensitive" as const } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.inboundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeInboundTransaction,
            }),
            ctx.db.inboundTransaction.count({ where }),
        ]);

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      
        const row = await ctx.db.inboundTransaction.findUnique({
            where: { id: input.id },
            include:{
                items: {
                    include: {
                        sku: true,
                        palletType: true,
                        pallets: true
                    },
                },
            }
        });

        return row;
    }),

    create: transactionalProtectedProcedure.input(inboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
            palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
        });

        const created = await ctx.db.inboundTransaction.create({
            data: {
                id: input.id || undefined,
                date: input.date ?? new Date(),
                sender: normalizeText(input.sender),
                reference: normalizeText(input.reference),
                asnNumber: normalizeText(input.asnNumber),
                carrier: normalizeText(input.carrier),
                trackingNumber: normalizeText(input.trackingNumber),
                bolNumber: normalizeText(input.bolNumber),
                driverName: normalizeText(input.driverName),
                driverContact: normalizeText(input.driverContact),
                vehiclePlate: normalizeText(input.vehiclePlate),
                files: input.files ?? undefined,
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? "DRAFT",
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        palletTypeId: item.palletTypeId,
                        quantity: item.quantity,
                        sortOrder: item.sortOrder,
                    })),
                },
            },
            include: includeInboundTransaction,
        });
        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "inbound_transaction",
            resourceId: created.id,
            message: `Membuat transaksi masuk ${created.id}`,
            detail: {
                after: created,
            },
        });
        return created;
    }),

    update: transactionalProtectedProcedure
        .input(inboundTransactionInputSchema.extend({ currentId: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.currentId },
                include: {
                    items: {
                        select: {
                            id: true,
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOnly(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound')); 

            const generatedPalletCount = existing?.items.reduce((sum, item) => sum + item.pallets.length, 0) ?? 0;
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'inboundTransaction.cannotUpdateGeneratedPallets'),
                });
            }

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
            await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
                palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
                palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
            });

            const updated = await ctx.db.inboundTransaction.update({
                where: { id: input.currentId },
                data: {
                    id: input.id || undefined,
                    date: input.date ?? new Date(),
                    sender: normalizeText(input.sender),
                    reference: normalizeText(input.reference),
                    asnNumber: normalizeText(input.asnNumber),
                    carrier: normalizeText(input.carrier),
                    trackingNumber: normalizeText(input.trackingNumber),
                    bolNumber: normalizeText(input.bolNumber),
                    driverName: normalizeText(input.driverName),
                    driverContact: normalizeText(input.driverContact),
                    vehiclePlate: normalizeText(input.vehiclePlate),
                    files: input.files ?? undefined,
                    notes: normalizeText(input.notes),
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                            sortOrder: item.sortOrder,
                        })),
                    },
                },
                include: includeInboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: updated.id,
                message: `Memperbarui transaksi masuk ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.inboundTransaction.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    include: {
                        pallets: { select: { id: true } },
                    },
                },
            },
        });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
        }

        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

        const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
        if (generatedPalletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(ctx.locale, 'inboundTransaction.cannotDeleteGeneratedPallets'),
            });
        }

        await ctx.db.inboundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "inbound_transaction",
            resourceId: before.id,
            message: `Menghapus transaksi masuk ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'inboundTransaction.emptyItems') });
            }

            const generatedPalletCount = existing.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'inboundTransaction.alreadyGenerated'),
                });
            }

            await ctx.db.pallet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.quantity }, () => ({
                        palletTypeId: item.palletTypeId,
                        status: "RECEIVED" as const,
                        receivedAt: existing.date,
                        inboundTransactionId: existing.id,
                        inboundTransactionItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeInboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: approved.id,
                message: `Menyetujui transaksi masuk ${approved.id}`,
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

    reject: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            const rejected = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });
            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: rejected.id,
                message: `Menolak transaksi masuk ${rejected.id}`,
                detail: {
                    before: {
                        approvalStatus: existing?.approvalStatus ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
                    },
                    after: rejected,
                    rejectionMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
