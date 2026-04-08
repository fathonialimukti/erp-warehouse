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

const transaksiKeluarInputSchema = z.object({
    lokasiKeluarId: z.string().min(1, "Lokasi keluar wajib diisi"),
    tanggal: z.coerce.date().optional(),
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

const includeKeluar = {
    lokasiKeluar: true,
    createdBy: true,
    approvedBy: true,
    items: {
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
            message: "Sebagian palet tidak bisa dipakai untuk transaksi keluar.",
        });
    }
};

export const transaksiKeluarRouter = router({
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
                          { keterangan: { contains: search, mode: "insensitive" as const } },
                          { items: { some: { palet: { id: { contains: search, mode: "insensitive" as const } } } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.transaksiPengeluaran.findMany({
                where,
                skip,
                take: limit,
                orderBy: { tanggal: "desc" },
                include: includeKeluar,
            }),
            ctx.db.transaksiPengeluaran.count({ where }),
        ]);

        return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.transaksiPengeluaran.findUnique({
            where: { id: input.id },
            include: includeKeluar,
        });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi keluar tidak ditemukan." });
        }

        return row;
    }),

    create: transactionalProtectedProcedure.input(transaksiKeluarInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicatePalet(input.paletIds);
        await ensurePaletsAvailable(ctx.db, input.paletIds);

        const created = await ctx.db.transaksiPengeluaran.create({
            data: {
                lokasiKeluarId: input.lokasiKeluarId,
                tanggal: input.tanggal ?? new Date(),
                keterangan: normalizeText(input.keterangan),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                statusApproval: "DRAFT",
                items: {
                    create: input.paletIds.map((paletId) => ({ paletId })),
                },
            },
            include: includeKeluar,
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
        .input(transaksiKeluarInputSchema.extend({ id: z.string(), statusApproval: z.enum(statusApprovalValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiPengeluaran.findUnique({ where: { id: input.id } });
            ensureDraftOnly(existing?.statusApproval ?? null, "Transaksi keluar tidak ditemukan.");

            ensureNoDuplicatePalet(input.paletIds);
            await ensurePaletsAvailable(ctx.db, input.paletIds);

            const updated = await ctx.db.transaksiPengeluaran.update({
                where: { id: input.id },
                data: {
                    lokasiKeluarId: input.lokasiKeluarId,
                    tanggal: input.tanggal ?? new Date(),
                    keterangan: normalizeText(input.keterangan),
                    approvalHistory: input.approvalHistory ?? [],
                    statusApproval: input.statusApproval,
                    items: {
                        deleteMany: {},
                        create: input.paletIds.map((paletId) => ({ paletId })),
                    },
                },
                include: includeKeluar,
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
        const before = await ctx.db.transaksiPengeluaran.findUnique({ where: { id: input.id } });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi keluar tidak ditemukan." });
        }

        ensureDraftOnly(before.statusApproval, "Transaksi keluar tidak ditemukan.");

        await ctx.db.transaksiPengeluaran.delete({ where: { id: input.id } });

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
            const existing = await ctx.db.transaksiPengeluaran.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            paletId: true,
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi keluar tidak ditemukan.");

            const paletIds = existing?.items.map((item) => item.paletId) ?? [];
            if (paletIds.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Daftar palet transaksi keluar kosong." });
            }

            await ensurePaletsAvailable(ctx.db, paletIds);

            await ctx.db.palet.updateMany({
                where: { id: { in: paletIds } },
                data: {
                    status: "DIKELUARKAN",
                    tanggalDikeluarkan: existing?.tanggal ?? new Date(),
                    lokasiPenyimpananId: null,
                },
            });

            const approved = await ctx.db.transaksiPengeluaran.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DISETUJUI", input.message),
                include: includeKeluar,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: approved.id,
                message: `Menyetujui transaksi keluar ${approved.id}`,
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
            const existing = await ctx.db.transaksiPengeluaran.findUnique({
                where: { id: input.id },
                select: { statusApproval: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi keluar tidak ditemukan.");

            const rejected = await ctx.db.transaksiPengeluaran.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DITOLAK", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_pengeluaran",
                resourceId: rejected.id,
                message: `Menolak transaksi keluar ${rejected.id}`,
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
