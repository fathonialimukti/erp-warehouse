import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
                    skuId: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.skuId ? { skuId: input.skuId } : {}),
                ...(search
                    ? {
                        OR: [
                            { nama: { contains: search, mode: "insensitive" as const } },
                            { id: { contains: search, mode: "insensitive" as const } },
                            { deskripsi: { contains: search, mode: "insensitive" as const } },
                        ],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.jenisPalet.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: { sku: true },
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
                include: { sku: true },
            });

            if (!jenisPalet) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Jenis palet tidak ditemukan" });
            }

            return jenisPalet;
        }),

    create: protectedProcedure
        .input(
            z.object({
                kode: z.string().min(1, "Kode wajib diisi"),
                nama: z.string().min(1, "Nama wajib diisi"),
                deskripsi: z.string().optional(),
                skuId: z.string().min(1, "SKU wajib diisi"),
                namaKemasan: z.string().min(1).default("carton"),
                kemasanPerPalet: z.number().int().min(1, "Kemasan per palet wajib diisi"),
                isiPerKemasan: z.number().min(0),
                satuanKemasan: z.string().min(1).default("kg"),
                panjang: z.number().int().optional(),
                lebar: z.number().int().optional(),
                tinggi: z.number().int().optional(),
                beratMaks: z.number().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.jenisPalet.create({
                data: {
                    id: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    skuId: input.skuId,
                    namaKemasan: input.namaKemasan,
                    kemasanPerPalet: input.kemasanPerPalet,
                    isiPerKemasan: input.isiPerKemasan,
                    satuanKemasan: input.satuanKemasan,
                    panjang: input.panjang ?? null,
                    lebar: input.lebar ?? null,
                    tinggi: input.tinggi ?? null,
                    beratMaks: input.beratMaks ?? null,
                },
                include: { sku: true },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                kode: z.string().min(1, "Kode wajib diisi"),
                nama: z.string().min(1, "Nama wajib diisi"),
                deskripsi: z.string().optional(),
                skuId: z.string().min(1, "SKU wajib diisi"),
                namaKemasan: z.string().min(1),
                kemasanPerPalet: z.number().int().min(1),
                isiPerKemasan: z.number().min(0),
                satuanKemasan: z.string().min(1),
                panjang: z.number().int().optional(),
                lebar: z.number().int().optional(),
                tinggi: z.number().int().optional(),
                beratMaks: z.number().optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.jenisPalet.update({
                where: { id: input.id },
                data: {
                    id: input.kode,
                    nama: input.nama,
                    deskripsi: input.deskripsi ?? null,
                    skuId: input.skuId,
                    namaKemasan: input.namaKemasan,
                    kemasanPerPalet: input.kemasanPerPalet,
                    isiPerKemasan: input.isiPerKemasan,
                    satuanKemasan: input.satuanKemasan,
                    panjang: input.panjang ?? null,
                    lebar: input.lebar ?? null,
                    tinggi: input.tinggi ?? null,
                    beratMaks: input.beratMaks ?? null,
                },
                include: { sku: true },
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
