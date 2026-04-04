import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";

const lokasiStatusValues = ["AKTIF", "MAINTENANCE", "PENUH"] as const;

const importRowSchema = z.object({
    kode: z.string().min(1, "Kode is required"),
    status: z.enum(lokasiStatusValues).optional(),
});

export const lokasiPenyimpananRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                    gudangId: z.string().optional(),
                    status: z.enum(lokasiStatusValues).optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.gudangId ? { gudangId: input.gudangId } : {}),
                ...(input?.status ? { status: input.status } : {}),
                ...(search
                    ? {
                        OR: [{ kode: { contains: search, mode: "insensitive" as const } }],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.lokasiPenyimpanan.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { kode: "asc" },
                    include: {
                        gudang: true,
                        palet: {
                            include: {
                                jenisPalet: {
                                    include: { sku: true },
                                },
                            },
                        },
                    },
                }),
                prisma.lokasiPenyimpanan.count({ where }),
            ]);

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }),

    exportAll: protectedProcedure
        .input(z.object({ gudangId: z.string().min(1, "Gudang is required") }))
        .query(async ({ input }) => {
            return prisma.lokasiPenyimpanan.findMany({
                where: { gudangId: input.gudangId },
                orderBy: { kode: "asc" },
                include: {
                    palet: {
                        include: {
                            jenisPalet: {
                                include: { sku: true },
                            },
                        },
                    },
                },
            });
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const lokasi = await prisma.lokasiPenyimpanan.findUnique({
                where: { id: input.id },
                include: {
                    gudang: true,
                    palet: {
                        include: {
                            jenisPalet: {
                                include: { sku: true },
                            },
                        },
                    },
                },
            });

            if (!lokasi) {
                throw new TRPCError({ code: "NOT_FOUND", message: "LokasiPenyimpanan not found" });
            }

            return lokasi;
        }),

    create: transactionalProtectedProcedure
        .input(
            z.object({
                gudangId: z.string().min(1, "Gudang is required"),
                kode: z.string().min(1, "Kode is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.lokasiPenyimpanan.create({
                data: {
                    gudangId: input.gudangId,
                    kode: input.kode,
                    status: input.status ?? "AKTIF",
                },
            });
        }),

    update: transactionalProtectedProcedure
        .input(
            z.object({
                id: z.string(),
                gudangId: z.string().min(1, "Gudang is required"),
                kode: z.string().min(1, "Kode is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.lokasiPenyimpanan.update({
                where: { id: input.id },
                data: {
                    gudangId: input.gudangId,
                    kode: input.kode,
                    status: input.status ?? "AKTIF",
                },
            });
        }),

    delete: transactionalProtectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await ctx.db.lokasiPenyimpanan.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),

    importBatch: transactionalProtectedProcedure
        .input(
            z.object({
                gudangId: z.string().min(1, "Gudang is required"),
                rows: z.array(importRowSchema),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const normalizedRows = input.rows.map((row) => ({
                ...row,
                kode: row.kode.trim(),
            }));

            const emptyKode = normalizedRows.find((row) => !row.kode);
            if (emptyKode) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Semua baris wajib memiliki kode." });
            }

            const duplicateKodes = normalizedRows
                .map((row) => row.kode)
                .filter((kode, index, arr) => arr.indexOf(kode) !== index);
            if (duplicateKodes.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Kode duplikat dalam file import: ${Array.from(new Set(duplicateKodes)).join(", ")}`,
                });
            }

            const existingRows = await ctx.db.lokasiPenyimpanan.findMany({
                where: { gudangId: input.gudangId },
                include: {
                    palet: true,
                },
            });

            const importedKodeSet = new Set(normalizedRows.map((row) => row.kode));
            const toDelete = existingRows.filter((row) => !importedKodeSet.has(row.kode));
            const blockedDelete = toDelete.filter((row) => row.palet !== null);

            if (blockedDelete.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Import gagal. Lokasi yang terisi palet tidak boleh terhapus: ${blockedDelete
                        .map((row) => row.kode)
                        .join(", ")}`,
                });
            }

            const importedKodes = normalizedRows.map((row) => row.kode);
            const rowsWithSameKodeDifferentGudang = await ctx.db.lokasiPenyimpanan.findMany({
                where: {
                    kode: { in: importedKodes },
                    gudangId: { not: input.gudangId },
                },
                select: { kode: true, gudangId: true },
            });

            if (rowsWithSameKodeDifferentGudang.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Import gagal. Kode sudah dipakai di gudang lain: ${rowsWithSameKodeDifferentGudang
                        .map((row) => row.kode)
                        .join(", ")}`,
                });
            }

            const existingKodeSet = new Set(existingRows.map((row) => row.kode));
            const deletedCount = toDelete.length;
            const createdCount = normalizedRows.filter((row) => !existingKodeSet.has(row.kode)).length;
            const updatedCount = normalizedRows.filter((row) => existingKodeSet.has(row.kode)).length;

            if (toDelete.length > 0) {
                await ctx.db.lokasiPenyimpanan.deleteMany({
                    where: {
                        id: {
                            in: toDelete.map((row) => row.id),
                        },
                    },
                });
            }

            for (const row of normalizedRows) {
                await ctx.db.lokasiPenyimpanan.upsert({
                    where: { kode: row.kode },
                    create: {
                        gudangId: input.gudangId,
                        kode: row.kode,
                        status: row.status ?? "AKTIF",
                    },
                    update: {
                        gudangId: input.gudangId,
                        status: row.status ?? "AKTIF",
                    },
                });
            }

            return {
                success: true,
                created: createdCount,
                updated: updatedCount,
                deleted: deletedCount,
            };
        }),
});
