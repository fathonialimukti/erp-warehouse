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

const inboundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU wajib diisi"),
    palletTypeId: z.string().min(1, "Jenis palet wajib diisi"),
    quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
});

const inboundTransactionInputSchema = z.object({
    incomingLocationId: z.string().optional(),
    date: z.coerce.date().optional(),
    notes: z.string().optional(),
    approvalStatus: z.enum(approvalStatusValues).optional(),
    items: z.array(inboundTransactionItemSchema).min(1, "Minimal satu item"),
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

const includeInboundTransaction = {
    incomingLocation: true,
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
                message: "Item duplikat untuk kombinasi SKU dan jenis palet tidak diperbolehkan.",
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
                message: `Jenis palet ${item.palletTypeId} tidak ditemukan.`,
            });
        }
        if (skuId !== item.skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Jenis palet ${item.palletTypeId} tidak sesuai dengan SKU ${item.skuId}.`,
            });
        }
    }
};

export const inboundTransactionRouter = router({
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
                          { notes: { contains: search, mode: "insensitive" as const } },
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

        const data = rows.map((row) => ({
            ...row,
            totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
            totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
        }));

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.inboundTransaction.findUnique({ where: { id: input.id }, include: includeInboundTransaction });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi masuk tidak ditemukan." });
        }

        return {
            ...row,
            totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
            totalPalletsGenerated: row.items.reduce((sum, item) => sum + item.pallets.length, 0),
        };
    }),

    create: transactionalProtectedProcedure.input(inboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateItem(input.items);
        await ensurePalletTypeMatchesSku(ctx.db, input.items);

        const created = await ctx.db.inboundTransaction.create({
            data: {
                incomingLocationId: input.incomingLocationId?.trim() ? input.incomingLocationId : null,
                date: input.date ?? new Date(),
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
        .input(inboundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
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
            ensureDraftOnly(existing?.approvalStatus ?? null, "Transaksi masuk tidak ditemukan.");

            const generatedPalletCount = existing?.items.reduce((sum, item) => sum + item.pallets.length, 0) ?? 0;
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Item tidak dapat diubah karena palet sudah tergenerate.",
                });
            }

            ensureNoDuplicateItem(input.items);
            await ensurePalletTypeMatchesSku(ctx.db, input.items);

            const updated = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: {
                    incomingLocationId: input.incomingLocationId?.trim() ? input.incomingLocationId : null,
                    date: input.date ?? new Date(),
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
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi masuk tidak ditemukan." });
        }

        ensureDraftOnly(before.approvalStatus, "Transaksi masuk tidak ditemukan.");

        const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
        if (generatedPalletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Transaksi tidak bisa dihapus karena palet sudah tergenerate.",
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
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi masuk tidak ditemukan.");

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Item transaksi masuk tidak boleh kosong." });
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
                        storageLocationId: existing.incomingLocationId,
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
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi masuk tidak ditemukan.");

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
