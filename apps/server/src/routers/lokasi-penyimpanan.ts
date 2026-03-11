import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

const lokasiTipeValues = ["RAK_PALET", "LANTAI_MARKA", "VIRTUAL"] as const;
const lokasiStatusValues = ["AKTIF", "MAINTENANCE", "PENUH"] as const;

export const lokasiPenyimpananRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                    gudangId: z.string().optional(),
                    tipe: z.enum(lokasiTipeValues).optional(),
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
                ...(input?.tipe ? { tipe: input.tipe } : {}),
                ...(input?.status ? { status: input.status } : {}),
                ...(search
                    ? {
                        OR: [
                            { kodeLokasi: { contains: search, mode: "insensitive" as const } },
                            { zona: { contains: search, mode: "insensitive" as const } },
                            { nomorMarka: { contains: search, mode: "insensitive" as const } },
                        ],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.lokasiPenyimpanan.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: { gudang: true },
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

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const lokasi = await prisma.lokasiPenyimpanan.findUnique({
                where: { id: input.id },
                include: { gudang: true },
            });

            if (!lokasi) {
                throw new Error("LokasiPenyimpanan not found");
            }

            return lokasi;
        }),

    create: protectedProcedure
        .input(
            z.object({
                gudangId: z.string().min(1, "Gudang is required"),
                kodeLokasi: z.string().min(1, "Kode lokasi is required"),
                tipe: z.enum(lokasiTipeValues),
                baris: z.string().optional(),
                rak: z.string().optional(),
                tingkat: z.string().optional(),
                posisi: z.string().optional(),
                zona: z.string().optional(),
                nomorMarka: z.string().optional(),
                kapasitas: z.number().int().min(1).optional(),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.lokasiPenyimpanan.create({
                data: {
                    gudangId: input.gudangId,
                    kodeLokasi: input.kodeLokasi,
                    tipe: input.tipe,
                    baris: input.baris ?? null,
                    rak: input.rak ?? null,
                    tingkat: input.tingkat ?? null,
                    posisi: input.posisi ?? null,
                    zona: input.zona ?? null,
                    nomorMarka: input.nomorMarka ?? null,
                    kapasitas: input.kapasitas ?? 1,
                    status: input.status ?? "AKTIF",
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                gudangId: z.string().min(1, "Gudang is required"),
                kodeLokasi: z.string().min(1, "Kode lokasi is required"),
                tipe: z.enum(lokasiTipeValues),
                baris: z.string().optional(),
                rak: z.string().optional(),
                tingkat: z.string().optional(),
                posisi: z.string().optional(),
                zona: z.string().optional(),
                nomorMarka: z.string().optional(),
                kapasitas: z.number().int().min(1).optional(),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.lokasiPenyimpanan.update({
                where: { id: input.id },
                data: {
                    gudangId: input.gudangId,
                    kodeLokasi: input.kodeLokasi,
                    tipe: input.tipe,
                    baris: input.baris ?? null,
                    rak: input.rak ?? null,
                    tingkat: input.tingkat ?? null,
                    posisi: input.posisi ?? null,
                    zona: input.zona ?? null,
                    nomorMarka: input.nomorMarka ?? null,
                    kapasitas: input.kapasitas ?? 1,
                    status: input.status ?? "AKTIF",
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.lokasiPenyimpanan.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
