import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";

const paletStatusValues = [
    "DITERIMA",
    "DITEMPATKAN",
    "DIKELUARKAN",
    "HILANG",
    "DITEMUKAN",
    "RUSAK",
] as const;

export const paletRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                    status: z.enum(paletStatusValues).optional(),
                    jenisPaletId: z.string().optional(),
                    lokasiPenyimpananId: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.status ? { status: input.status } : {}),
                ...(input?.jenisPaletId ? { jenisPaletId: input.jenisPaletId } : {}),
                ...(input?.lokasiPenyimpananId
                    ? { lokasiPenyimpananId: input.lokasiPenyimpananId }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            { id: { contains: search, mode: "insensitive" as const } },
                            { jenisPalet: { id: { contains: search, mode: "insensitive" as const } } },
                            { jenisPalet: { nama: { contains: search, mode: "insensitive" as const } } },
                        ],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.palet.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: {
                        jenisPalet: { include: { sku: true } },
                        lokasiPenyimpanan: { include: { gudang: true } },
                    },
                }),
                prisma.palet.count({ where }),
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

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const palet = await prisma.palet.findUnique({
                where: { id: input.id },
                include: {
                    jenisPalet: { include: { sku: true } },
                    lokasiPenyimpanan: { include: { gudang: true } },
                },
            });

            if (!palet) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Palet tidak ditemukan" });
            }

            return palet;
        }),

    create: transactionalProtectedProcedure
        .input(
            z.object({
                jenisPaletId: z.string().min(1, "Jenis palet wajib diisi"),
                lokasiPenyimpananId: z.string().optional(),
                status: z.enum(paletStatusValues).default("DITERIMA"),
                tanggalDiterima: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.palet.create({
                data: {
                    jenisPaletId: input.jenisPaletId,
                    lokasiPenyimpananId: input.lokasiPenyimpananId ?? null,
                    status: input.status,
                    tanggalDiterima: input.tanggalDiterima ?? null,
                },
                include: {
                    jenisPalet: { include: { sku: true } },
                },
            });
        }),

    update: transactionalProtectedProcedure
        .input(
            z.object({
                id: z.string(),
                jenisPaletId: z.string().min(1, "Jenis palet wajib diisi"),
                lokasiPenyimpananId: z.string().optional(),
                status: z.enum(paletStatusValues),
                tanggalDiterima: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.palet.update({
                where: { id: input.id },
                data: {
                    jenisPaletId: input.jenisPaletId,
                    lokasiPenyimpananId: input.lokasiPenyimpananId ?? null,
                    status: input.status,
                    tanggalDiterima: input.tanggalDiterima ?? null,
                },
                include: {
                    jenisPalet: { include: { sku: true } },
                },
            });
        }),

    delete: transactionalProtectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await ctx.db.palet.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});

