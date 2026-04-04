import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

export const skuRouter = router({
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
                prisma.sku.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.sku.count({ where }),
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
            const sku = await prisma.sku.findUnique({
                where: { id: input.id },
            });

            if (!sku) {
                throw new TRPCError({ code: "NOT_FOUND", message: "SKU tidak ditemukan" });
            }

            return sku;
        }),

    create: protectedProcedure
        .input(
            z.object({
                kode: z.string().min(1, "Kode wajib diisi"),
                nama: z.string().min(1, "Nama wajib diisi"),
                deskripsi: z.string().optional(),
                foto: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.sku.create({
                data: {
                    kode: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    foto: input.foto ?? null,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                kode: z.string().min(1, "Kode wajib diisi"),
                nama: z.string().min(1, "Nama wajib diisi"),
                deskripsi: z.string().optional(),
                foto: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.sku.update({
                where: { id: input.id },
                data: {
                    kode: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    foto: input.foto ?? null,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.sku.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
