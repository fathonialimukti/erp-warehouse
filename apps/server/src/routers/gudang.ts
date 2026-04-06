import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

export const gudangRouter = router({
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
                        { id: { contains: search, mode: "insensitive" as const } },
                        { nama: { contains: search, mode: "insensitive" as const } },
                        { alamat: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.gudang.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.gudang.count({ where }),
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
            const gudang = await prisma.gudang.findUnique({
                where: { id: input.id },
            });

            if (!gudang) {
                throw new Error("Gudang not found");
            }

            return gudang;
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                nama: z.string().min(1, "Nama is required"),
                alamat: z.string().min(1, "Alamat is required"),
                kapasitasTotal: z.number().int().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.gudang.create({
                data: {
                    id: input.id.trim(),
                    nama: input.nama,
                    alamat: input.alamat,
                    kapasitasTotal: input.kapasitasTotal ?? null,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                currentId: z.string(),
                id: z.string().min(1, "ID is required"),
                nama: z.string().min(1, "Nama is required"),
                alamat: z.string().min(1, "Alamat is required"),
                kapasitasTotal: z.number().int().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.gudang.update({
                where: { id: input.currentId },
                data: {
                    id: input.id.trim(),
                    nama: input.nama,
                    alamat: input.alamat,
                    kapasitasTotal: input.kapasitasTotal ?? null,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.gudang.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
