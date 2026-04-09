import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    buildApprovalActionData,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    statusApprovalValues,
} from "./transaksi-common";

const transaksiTemuanItemSchema = z.object({
    skuId: z.string().min(1, "SKU wajib diisi"),
    jenisPaletId: z.string().min(1, "Jenis palet wajib diisi"),
    jumlah: z.coerce.number().int().min(1, "Jumlah minimal 1"),
});

const transaksiTemuanInputSchema = z.object({
    tanggal: z.coerce.date().optional(),
    jenisTemuan: z.string().optional(),
    referensi: z.string().optional(),
    keterangan: z.string().optional(),
    statusApproval: z.enum(statusApprovalValues).optional(),
    items: z.array(transaksiTemuanItemSchema).min(1, "Minimal satu item"),
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

const includeTemuan = {
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            sku: true,
            jenisPalet: true,
            palets: {
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

const ensureNoDuplicateItem = (items: Array<{ skuId: string; jenisPaletId: string }>) => {
    const keys = new Set<string>();
    for (const item of items) {
        const key = `${item.skuId}:${item.jenisPaletId}`;
        if (keys.has(key)) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Item duplikat untuk kombinasi SKU dan jenis palet tidak diperbolehkan.",
            });
        }
        keys.add(key);
    }
};

const ensureJenisPaletMatchesSku = async (
    db: any,
    items: Array<{ skuId: string; jenisPaletId: string }>,
) => {
    const jenisPaletIds = items.map((item) => item.jenisPaletId);
    const jenisPaletRows = await db.jenisPalet.findMany({
        where: { id: { in: jenisPaletIds } },
        select: { id: true, skuId: true },
    });

    const skuByJenisPaletId = new Map(jenisPaletRows.map((row: { id: string; skuId: string }) => [row.id, row.skuId]));

    for (const item of items) {
        const skuId = skuByJenisPaletId.get(item.jenisPaletId);
        if (!skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Jenis palet ${item.jenisPaletId} tidak ditemukan.`,
            });
        }
        if (skuId !== item.skuId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Jenis palet ${item.jenisPaletId} tidak sesuai dengan SKU ${item.skuId}.`,
            });
        }
    }
};

export const transaksiTemuanRouter = router({
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
                          { jenisTemuan: { contains: search, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.transaksiTemuan.findMany({
                where,
                skip,
                take: limit,
                orderBy: { tanggal: "desc" },
                include: includeTemuan,
            }),
            ctx.db.transaksiTemuan.count({ where }),
        ]);

        const data = rows.map((row) => ({
            ...row,
            totalJumlahItem: row.items.reduce((sum, item) => sum + item.jumlah, 0),
            totalPaletGenerated: row.items.reduce((sum, item) => sum + item.palets.length, 0),
        }));

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.transaksiTemuan.findUnique({ where: { id: input.id }, include: includeTemuan });
        if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi temuan tidak ditemukan." });
        }

        return {
            ...row,
            totalJumlahItem: row.items.reduce((sum, item) => sum + item.jumlah, 0),
            totalPaletGenerated: row.items.reduce((sum, item) => sum + item.palets.length, 0),
        };
    }),

    create: transactionalProtectedProcedure.input(transaksiTemuanInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateItem(input.items);
        await ensureJenisPaletMatchesSku(ctx.db, input.items);

        const created = await ctx.db.transaksiTemuan.create({
            data: {
                tanggal: input.tanggal ?? new Date(),
                jenisTemuan: normalizeText(input.jenisTemuan),
                referensi: normalizeText(input.referensi),
                keterangan: normalizeText(input.keterangan),
                createdById: ctx.user!.userId,
                approvalHistory: input.approvalHistory ?? [],
                statusApproval: input.statusApproval ?? "DRAFT",
                items: {
                    create: input.items.map((item) => ({
                        skuId: item.skuId,
                        jenisPaletId: item.jenisPaletId,
                        jumlah: item.jumlah,
                    })),
                },
            },
            include: includeTemuan,
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "transaksi_temuan",
            resourceId: created.id,
            message: `Membuat transaksi temuan ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(transaksiTemuanInputSchema.extend({ id: z.string(), statusApproval: z.enum(statusApprovalValues) }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiTemuan.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        select: {
                            id: true,
                            palets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOnly(existing?.statusApproval ?? null, "Transaksi temuan tidak ditemukan.");

            const generatedPaletCount = existing?.items.reduce((sum, item) => sum + item.palets.length, 0) ?? 0;
            if (generatedPaletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Item tidak dapat diubah karena palet sudah tergenerate.",
                });
            }

            ensureNoDuplicateItem(input.items);
            await ensureJenisPaletMatchesSku(ctx.db, input.items);

            const updated = await ctx.db.transaksiTemuan.update({
                where: { id: input.id },
                data: {
                    tanggal: input.tanggal ?? new Date(),
                    jenisTemuan: normalizeText(input.jenisTemuan),
                    referensi: normalizeText(input.referensi),
                    keterangan: normalizeText(input.keterangan),
                    approvalHistory: input.approvalHistory ?? [],
                    statusApproval: input.statusApproval,
                    items: {
                        deleteMany: {},
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            jenisPaletId: item.jenisPaletId,
                            jumlah: item.jumlah,
                        })),
                    },
                },
                include: includeTemuan,
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
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
        const before = await ctx.db.transaksiTemuan.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    include: {
                        palets: { select: { id: true } },
                    },
                },
            },
        });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi temuan tidak ditemukan." });
        }

        ensureDraftOnly(before.statusApproval, "Transaksi temuan tidak ditemukan.");

        const generatedPaletCount = before.items.reduce((sum, item) => sum + item.palets.length, 0);
        if (generatedPaletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Transaksi tidak bisa dihapus karena palet sudah tergenerate.",
            });
        }

        await ctx.db.transaksiTemuan.delete({ where: { id: input.id } });

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
            const existing = await ctx.db.transaksiTemuan.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            palets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi temuan tidak ditemukan.");

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Item transaksi temuan tidak boleh kosong." });
            }

            const generatedPaletCount = existing.items.reduce((sum, item) => sum + item.palets.length, 0);
            if (generatedPaletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Palet untuk transaksi ini sudah pernah digenerate.",
                });
            }

            await ctx.db.palet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.jumlah }, () => ({
                        jenisPaletId: item.jenisPaletId,
                        status: "DITERIMA" as const,
                        tanggalDiterima: existing.tanggal,
                        transaksiTemuanItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.transaksiTemuan.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "DISETUJUI", input.message),
                include: includeTemuan,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: approved.id,
                message: `Menyetujui transaksi temuan ${approved.id}`,
                detail: {
                    before: {
                        statusApproval: existing.statusApproval,
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
            const existing = await ctx.db.transaksiTemuan.findUnique({
                where: { id: input.id },
                select: { statusApproval: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "Transaksi temuan tidak ditemukan.");

            const rejected = await ctx.db.transaksiTemuan.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DITOLAK", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_temuan",
                resourceId: rejected.id,
                message: `Menolak transaksi temuan ${rejected.id}`,
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
