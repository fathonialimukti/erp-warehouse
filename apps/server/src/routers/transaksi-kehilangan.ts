import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    buildApprovalActionData,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    statusApprovalValues,
} from "./transaksi-common.js";

const AVAILABLE_PALET_STATUSES = ["DITERIMA", "DITEMPATKAN", "DITEMUKAN"] as const;

const transaksiKehilanganInputSchema = z.object({
    tanggal: z.coerce.date().optional(),
    alasanKehilangan: z.string().optional(),
    nilaiEstimasi: z.coerce.number().nonnegative().optional(),
    referensi: z.string().optional(),
    keterangan: z.string().optional(),
    paletIds: z.array(z.string().min(1)).min(1, "Minimal satu palet"),
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
        statusApproval: z.enum(statusApprovalValues).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
    })
    .optional();

const includeKehilangan = {
    createdBy: true,
    approvedBy: true,
    paletPivots: {
        include: {
            palet: {
                include: {
                    jenisPalet: {
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

const ensureNoDuplicatePalet = (paletIds: string[]) => {
    const uniqueIds = new Set(paletIds);
    if (uniqueIds.size !== paletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Daftar palet tidak boleh duplikat.",
        });
    }
};

const ensurePaletsAvailable = async (db: any, paletIds: string[]) => {
    const palets = await db.palet.findMany({
        where: { id: { in: paletIds } },
        select: { id: true, status: true },
    });

    if (palets.length !== paletIds.length) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sebagian palet tidak ditemukan.",
        });
    }

    const invalidPalet = palets.find((palet: { status: string }) =>
        !AVAILABLE_PALET_STATUSES.includes(palet.status as (typeof AVAILABLE_PALET_STATUSES)[number]),
    );

    if (invalidPalet) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sebagian palet tidak bisa dipakai untuk transaksi kehilangan.",
        });
    }
};

export const transaksiKehilanganRouter = router({
    list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 10;
        const skip = (page - 1) * limit;
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...(input?.statusApproval ? { statusApproval: input.statusApproval } : {}),
            ...(input?.dateFrom || input?.dateTo
                ? {
                      tanggal: {
                          ...(input?.dateFrom ? { gte: input.dateFrom } : {}),
                          ...(input?.dateTo ? { lte: input.dateTo } : {}),
                      },
                  }
                : {}),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { referensi: { contains: search, mode: "insensitive" as const } },
                          { keterangan: { contains: search, mode: "insensitive" as const } },
                          { alasanKehilangan: { contains: search, mode: "insensitive" as const } },
                          { paletPivots: { some: { palet: { id: { contains: search, mode: "insensitive" as const } } } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.transaksiKehilangan.findMany({
                where,
                skip,
                take: limit,
                orderBy: { tanggal: "desc" },
                include: includeKehilangan,
            }),
            ctx.db.transaksiKehilangan.count({ where }),
        ]);

        return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.transaksiKehilangan.findUnique({
            where: { id: input.id },
            include: includeKehilangan,
        });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi kehilangan tidak ditemukan." });
        }

        return row;
    }),

    create: transactionalProtectedProcedure
        .input(transaksiKehilanganInputSchema)
        .mutation(async ({ ctx, input }) => {
            ensureNoDuplicatePalet(input.paletIds);
            await ensurePaletsAvailable(ctx.db, input.paletIds);

            const created = await ctx.db.transaksiKehilangan.create({
                data: {
                    tanggal: input.tanggal ?? new Date(),
                    alasanKehilangan: normalizeText(input.alasanKehilangan),
                    nilaiEstimasi: input.nilaiEstimasi ?? null,
                    referensi: normalizeText(input.referensi),
                    keterangan: normalizeText(input.keterangan),
                    createdById: ctx.user!.userId,
                    approvalHistory: input.approvalHistory ?? [],
                    statusApproval: "DRAFT",
                    paletPivots: {
                        create: input.paletIds.map((paletId) => ({ paletId })),
                    },
                },
                include: includeKehilangan,
            });

            await logActivity(ctx.db, {
                action: "CREATE",
                userId: ctx.user!.userId,
                resource: "transaksi_kehilangan",
                resourceId: created.id,
                message: `Membuat transaksi kehilangan ${created.id}`,
                detail: {
                    after: created,
                },
            });

            return created;
        }),

    update: transactionalProtectedProcedure
        .input(transaksiKehilanganInputSchema.extend({ id: z.string(), statusApproval: z.enum(statusApprovalValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiKehilangan.findUnique({ where: { id: input.id } });
            ensureDraftOnly(existing?.statusApproval ?? null, "Transaksi kehilangan tidak ditemukan.");

            ensureNoDuplicatePalet(input.paletIds);
            await ensurePaletsAvailable(ctx.db, input.paletIds);

            const updated = await ctx.db.transaksiKehilangan.update({
                where: { id: input.id },
                data: {
                    tanggal: input.tanggal ?? new Date(),
                    alasanKehilangan: normalizeText(input.alasanKehilangan),
                    nilaiEstimasi: input.nilaiEstimasi ?? null,
                    referensi: normalizeText(input.referensi),
                    keterangan: normalizeText(input.keterangan),
                    approvalHistory: input.approvalHistory ?? [],
                    statusApproval: input.statusApproval,
                    paletPivots: {
                        deleteMany: {},
                        create: input.paletIds.map((paletId) => ({ paletId })),
                    },
                },
                include: includeKehilangan,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "transaksi_kehilangan",
                resourceId: updated.id,
                message: `Memperbarui transaksi kehilangan ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.transaksiKehilangan.findUnique({ where: { id: input.id } });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi kehilangan tidak ditemukan." });
        }

        ensureDraftOnly(before.statusApproval, "Transaksi kehilangan tidak ditemukan.");

        await ctx.db.transaksiKehilangan.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_kehilangan",
            resourceId: before.id,
            message: `Menghapus transaksi kehilangan ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiKehilangan.findUnique({
                where: { id: input.id },
                include: {
                    paletPivots: {
                        select: {
                            paletId: true,
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi kehilangan tidak ditemukan.");

            const paletIds = existing?.paletPivots.map((pivot) => pivot.paletId) ?? [];
            if (paletIds.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Daftar palet transaksi kehilangan kosong." });
            }

            await ensurePaletsAvailable(ctx.db, paletIds);

            await ctx.db.palet.updateMany({
                where: { id: { in: paletIds } },
                data: {
                    status: "HILANG",
                    lokasiPenyimpananId: null,
                },
            });

            const approved = await ctx.db.transaksiKehilangan.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DISETUJUI", input.message),
                include: includeKehilangan,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_kehilangan",
                resourceId: approved.id,
                message: `Menyetujui transaksi kehilangan ${approved.id}`,
                detail: {
                    before: {
                        statusApproval: existing?.statusApproval ?? null,
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
            const existing = await ctx.db.transaksiKehilangan.findUnique({
                where: { id: input.id },
                select: { statusApproval: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi kehilangan tidak ditemukan.");

            const rejected = await ctx.db.transaksiKehilangan.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DITOLAK", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_kehilangan",
                resourceId: rejected.id,
                message: `Menolak transaksi kehilangan ${rejected.id}`,
                detail: {
                    before: {
                        statusApproval: existing?.statusApproval ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
                    },
                    after: rejected,
                    rejectionMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
