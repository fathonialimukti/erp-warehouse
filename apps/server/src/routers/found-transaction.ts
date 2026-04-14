import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    buildApprovalActionData,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    approvalStatusValues,
} from "./transaction-common";

const foundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU is required"),
    palletTypeId: z.string().min(1, "Pallet type is required"),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

const foundTransactionInputSchema = z.object({
    date: z.coerce.date().optional(),
    findingType: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    approvalStatus: z.enum(approvalStatusValues).optional(),
    items: z.array(foundTransactionItemSchema).min(1, "At least one item is required"),
    approvalHistory: z
        .array(
            z.object({
                process: z.string(),
                userName: z.string(),
                timeframe: z.string(),
                message: z.string().default(""),
            }),
        )
        .optional(),
});

const listInputSchema = z
    .object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional(),
        approvalStatus: z.enum(approvalStatusValues).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
    })
    .optional();

const includeFoundTransaction = {
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

const normalizeText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const ensureNoDuplicateItem = (items: Array<{ skuId: string; palletTypeId: string }>) => {
    const keys = new Set<string>();
    for (const item of items) {
        const key = `${item.skuId}:${item.palletTypeId}`;
        if (keys.has(key)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Duplicate item for SKU and pallet type is not allowed.",
            });
        }
        keys.add(key);
    }
};

const ensurePalletTypeMatchesSku = async (
    db: any,
    items: Array<{ skuId: string; palletTypeId: string }>,
) => {
    const palletTypeIds = items.map((item) => item.palletTypeId);
    const palletTypeRows = await db.palletType.findMany({
        where: { id: { in: palletTypeIds } },
        select: { id: true, skuId: true },
    });

    const skuByPalletTypeId = new Map(palletTypeRows.map((row: { id: string; skuId: string }) => [row.id, row.skuId]));

    for (const item of items) {
        const skuId = skuByPalletTypeId.get(item.palletTypeId);
        if (!skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Pallet type ${item.palletTypeId} not found.`,
            });
        }
        if (skuId !== item.skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Pallet type ${item.palletTypeId} does not match SKU ${item.skuId}.`,
            });
        }
    }
};

export const foundTransactionRouter = router({
    list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 10;
        const skip = (page - 1) * limit;
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...(input?.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
            ...(input?.dateFrom || input?.dateTo
                ? {
                      date: {
                          ...(input?.dateFrom ? { gte: input.dateFrom } : {}),
                          ...(input?.dateTo ? { lte: input.dateTo } : {}),
                      },
                  }
                : {}),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { reference: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { findingType: { contains: search, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.foundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeFoundTransaction,
            }),
            ctx.db.foundTransaction.count({ where }),
        ]);

        const data = rows.map((row) => ({
            ...row,
            totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
            totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
        }));

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.foundTransaction.findUnique({ where: { id: input.id }, include: includeFoundTransaction });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Found transaction not found." });
        }

        return {
            ...row,
            totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
            totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
        };
    }),

    create: transactionalProtectedProcedure.input(foundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateItem(input.items);
        await ensurePalletTypeMatchesSku(ctx.db, input.items);

        const created = await ctx.db.foundTransaction.create({
            data: {
                date: input.date ?? new Date(),
                findingType: normalizeText(input.findingType),
                reference: normalizeText(input.reference),
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? "DRAFT",
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        palletTypeId: item.palletTypeId,
                        quantity: item.quantity,
                    })),
                },
            },
            include: includeFoundTransaction,
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "found_transaction",
            resourceId: created.id,
            message: `Membuat transaksi temuan ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(foundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            id: true,
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOnly(existing?.approvalStatus ?? null, "Transaksi temuan tidak ditemukan.");

            const generatedPalletCount = existing?.items.reduce((sum, item) => sum + item.pallets.length, 0) ?? 0;
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Item tidak dapat diubah karena palet sudah tergenerate.",
                });
            }

            ensureNoDuplicateItem(input.items);
            await ensurePalletTypeMatchesSku(ctx.db, input.items);

            const updated = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: {
                    date: input.date ?? new Date(),
                    findingType: normalizeText(input.findingType),
                    reference: normalizeText(input.reference),
                    notes: normalizeText(input.notes),
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                        })),
                    },
                },
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "found_transaction",
                resourceId: updated.id,
                message: `Memperbarui transaksi temuan ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.foundTransaction.findUnique({
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
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi temuan tidak ditemukan." });
        }

        ensureDraftOnly(before.approvalStatus, "Transaksi temuan tidak ditemukan.");

const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Cannot delete transaction because pallets have already been generated.",
            });
        }

        await ctx.db.foundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_temuan",
            resourceId: before.id,
            message: `Menghapus transaksi temuan ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi temuan tidak ditemukan.");

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Item transaksi temuan tidak boleh kosong." });
            }

            const generatedPalletCount = existing.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Palet untuk transaksi ini sudah pernah digenerate.",
                });
            }

            await ctx.db.pallet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.quantity }, () => ({
                        palletTypeId: item.palletTypeId,
                        status: "RECEIVED" as const,
                        receivedAt: existing.date,
                        foundTransactionItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeFoundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: approved.id,
                message: `Menyetujui transaksi temuan ${approved.id}`,
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
            const existing = await ctx.db.foundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi temuan tidak ditemukan.");

            const rejected = await ctx.db.foundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: rejected.id,
                message: `Menolak transaksi temuan ${rejected.id}`,
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
