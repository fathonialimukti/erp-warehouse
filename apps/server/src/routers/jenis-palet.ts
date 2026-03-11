import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

export const jenisPaletRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = search
                ? {
                    OR: [
                        { nama: { contains: search, mode: "insensitive" as const } },
                        { kode: { contains: search, mode: "insensitive" as const } },
                        { deskripsi: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.jenisPalet.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.jenisPalet.count({ where }),
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
            const jenisPalet = await prisma.jenisPalet.findUnique({
                where: { id: input.id },
            });

            if (!jenisPalet) {
                throw new Error("JenisPalet not found");
            }

            return jenisPalet;
        }),

    create: protectedProcedure
        .input(
            z.object({
                kode: z.string().min(1, "Kode is required"),
                nama: z.string().min(1, "Nama is required"),
                deskripsi: z.string().optional(),
                panjang: z.number().int().min(1, "Panjang is required"),
                lebar: z.number().int().min(1, "Lebar is required"),
                tinggi: z.number().int().min(1, "Tinggi is required"),
                beratMaks: z.number().int().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.jenisPalet.create({
                data: {
                    kode: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    panjang: input.panjang,
                    lebar: input.lebar,
                    tinggi: input.tinggi,
                    beratMaks: input.beratMaks ?? null,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                kode: z.string().min(1, "Kode is required"),
                nama: z.string().min(1, "Nama is required"),
                deskripsi: z.string().optional(),
                panjang: z.number().int().min(1, "Panjang is required"),
                lebar: z.number().int().min(1, "Lebar is required"),
                tinggi: z.number().int().min(1, "Tinggi is required"),
                beratMaks: z.number().int().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.jenisPalet.update({
                where: { id: input.id },
                data: {
                    kode: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    panjang: input.panjang,
                    lebar: input.lebar,
                    tinggi: input.tinggi,
                    beratMaks: input.beratMaks ?? null,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.jenisPalet.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
