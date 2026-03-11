import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

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
                            { nomorSeri: { contains: search, mode: "insensitive" as const } },
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
                        jenisPalet: true,
                        lokasiPenyimpanan: true,
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
                    jenisPalet: true,
                    lokasiPenyimpanan: true,
                },
            });

            if (!palet) {
                throw new Error("Palet not found");
            }

            return palet;
        }),

    create: protectedProcedure
        .input(
            z.object({
                jenisPaletId: z.string().min(1, "Jenis palet is required"),
                lokasiPenyimpananId: z.string().optional(),
                status: z.enum(paletStatusValues).default("DITERIMA"),
                tanggalDiterima: z.coerce.date().optional(),
                nomorSeri: z.string().optional(),
                kondisi: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.palet.create({
                data: {
                    jenisPaletId: input.jenisPaletId,
                    lokasiPenyimpananId: input.lokasiPenyimpananId ?? null,
                    status: input.status,
                    tanggalDiterima: input.tanggalDiterima ?? null,
                    nomorSeri: input.nomorSeri ?? null,
                    kondisi: input.kondisi ?? null,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                jenisPaletId: z.string().min(1, "Jenis palet is required"),
                lokasiPenyimpananId: z.string().optional(),
                status: z.enum(paletStatusValues),
                tanggalDiterima: z.coerce.date().optional(),
                nomorSeri: z.string().optional(),
                kondisi: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.palet.update({
                where: { id: input.id },
                data: {
                    jenisPaletId: input.jenisPaletId,
                    lokasiPenyimpananId: input.lokasiPenyimpananId ?? null,
                    status: input.status,
                    tanggalDiterima: input.tanggalDiterima ?? null,
                    nomorSeri: input.nomorSeri ?? null,
                    kondisi: input.kondisi ?? null,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.palet.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
