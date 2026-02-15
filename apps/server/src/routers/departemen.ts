import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const t = initTRPC.create();

export const departemenRouter = t.router({
    list: t.procedure
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
                        { deskripsi: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.departemen.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.departemen.count({ where }),
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

    detail: t.procedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const departemen = await prisma.departemen.findUnique({
                where: { id: input.id },
            });

            if (!departemen) {
                throw new Error("Departemen not found");
            }

            return departemen;
        }),

    create: t.procedure
        .input(
            z.object({
                nama: z.string().min(1, "Nama is required"),
                deskripsi: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const departemen = await prisma.departemen.create({
                data: {
                    nama: input.nama,
                    deskripsi: input.deskripsi || null,
                },
            });

            return departemen;
        }),

    update: t.procedure
        .input(
            z.object({
                id: z.string(),
                nama: z.string().min(1, "Nama is required"),
                deskripsi: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const departemen = await prisma.departemen.update({
                where: { id: input.id },
                data: {
                    nama: input.nama,
                    deskripsi: input.deskripsi || null,
                },
            });

            return departemen;
        }),

    delete: t.procedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.departemen.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
