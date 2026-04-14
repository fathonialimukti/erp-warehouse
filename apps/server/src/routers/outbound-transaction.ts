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

const AVAILABLE_PALET_STATUSES = ["RECEIVED", "PLACED", "FOUND"] as const;

const outboundTransactionInputSchema = z.object({
    outgoingLocationId: z.string().min(1, "Outgoing location is required"),
    date: z.coerce.date().optional(),
    notes: z.string().optional(),
    approvalStatus: z.enum(approvalStatusValues).optional(),
    palletIds: z.array(z.string().min(1)).min(1, "At least one pallet is required"),
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

const includeOutboundTransaction = {
    outgoingLocation: true,
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            pallet: {
                include: {
                    palletType: {
                        include: {
                            sku: true,
                        },
                    },
                },
            },
        },
    },
} as const;

const normalizeText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const ensureNoDuplicatePallet = (palletIds: string[]) => {
    const uniqueIds = new Set(palletIds);
    if (uniqueIds.size !== palletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duplicate pallet IDs are not allowed.",
        });
    }
};

const ensurePalletsAvailable = async (db: any, palletIds: string[]) => {
    const pallets = await db.pallet.findMany({
        where: { id: { in: palletIds } },
        select: { id: true, status: true },
    });

    if (pallets.length !== palletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Some pallets were not found.",
        });
    }

    const invalidPallet = pallets.find((pallet: { status: string }) =>
        !AVAILABLE_PALET_STATUSES.includes(pallet.status as (typeof AVAILABLE_PALET_STATUSES)[number]),
    );

    if (invalidPallet) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Some pallets cannot be used for outbound transactions.",
        });
    }
};

export const outboundTransactionRouter = router({
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
                              { items: { some: { pallet: { id: { contains: search, mode: "insensitive" as const } } } } },
                          ],
                      }
                    : {}),
            };

            const [rows, total] = await Promise.all([
                ctx.db.outboundTransaction.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { date: "desc" },
                    include: includeOutboundTransaction,
                }),
                ctx.db.outboundTransaction.count({ where }),
            ]);

            return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
        }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.outboundTransaction.findUnique({
            where: { id: input.id },
            include: includeOutboundTransaction,
        });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi keluar tidak ditemukan." });
        }

        return row;
    }),

    create: transactionalProtectedProcedure.input(outboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicatePallet(input.palletIds);
        await ensurePalletsAvailable(ctx.db, input.palletIds);

        const created = await ctx.db.outboundTransaction.create({
            data: {
                outgoingLocationId: input.outgoingLocationId,
                date: input.date ?? new Date(),
                notes: normalizeText(input.notes),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                approvalStatus: input.approvalStatus ?? "DRAFT",
                items: {
                    create: input.palletIds.map((palletId) => ({ palletId })),
                },
            },
            include: includeOutboundTransaction,
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "transaksi_pengeluaran",
            resourceId: created.id,
            message: `Membuat transaksi keluar ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(outboundTransactionInputSchema.extend({ id: z.string(), approvalStatus: z.enum(approvalStatusValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({ where: { id: input.id } });
            ensureDraftOnly(existing?.approvalStatus ?? null, "Transaksi keluar tidak ditemukan.");

            ensureNoDuplicatePallet(input.palletIds);
            await ensurePalletsAvailable(ctx.db, input.palletIds);

            const updated = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: {
                    outgoingLocationId: input.outgoingLocationId,
                    date: input.date ?? new Date(),
                    notes: normalizeText(input.notes),
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus,
                    items: {
                        deleteMany: {},
                        create: input.palletIds.map((palletId) => ({ palletId })),
                    },
                },
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: updated.id,
                message: `Memperbarui transaksi keluar ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.outboundTransaction.findUnique({ where: { id: input.id } });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi keluar tidak ditemukan." });
        }

        ensureDraftOnly(before.approvalStatus, "Transaksi keluar tidak ditemukan.");

        await ctx.db.outboundTransaction.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_pengeluaran",
            resourceId: before.id,
            message: `Menghapus transaksi keluar ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            palletId: true,
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi keluar tidak ditemukan.");

            const palletIds = existing?.items.map((item) => item.palletId) ?? [];
            if (palletIds.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Daftar palet transaksi keluar kosong." });
            }

            await ensurePalletsAvailable(ctx.db, palletIds);

            await ctx.db.pallet.updateMany({
                where: { id: { in: palletIds } },
                data: {
                    status: "DISPATCHED",
                    dispatchedAt: existing?.date ?? new Date(),
                    storageLocationId: null,
                },
            });

            const approved = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeOutboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: approved.id,
                message: `Menyetujui transaksi keluar ${approved.id}`,
                detail: {
                    before: {
                        approvalStatus: existing?.approvalStatus ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
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
            const existing = await ctx.db.outboundTransaction.findUnique({
                where: { id: input.id },
                select: { approvalStatus: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, "Transaksi keluar tidak ditemukan.");

            const rejected = await ctx.db.outboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "REJECTED", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: rejected.id,
                message: `Menolak transaksi keluar ${rejected.id}`,
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
