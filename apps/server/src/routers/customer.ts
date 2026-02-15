import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const t = initTRPC.create();

export const customerRouter = t.router({
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
                        { email: { contains: search, mode: "insensitive" as const } },
                        { no_hp: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.customer.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.customer.count({ where }),
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
            const customer = await prisma.customer.findUnique({
                where: { id: input.id },
            });

            if (!customer) {
                throw new Error("Customer not found");
            }

            return customer;
        }),

    create: t.procedure
        .input(
            z.object({
                nama: z.string().min(1, "Nama is required"),
                no_hp: z.string().optional(),
                email: z.string().email().optional().or(z.literal("")),
                alamat: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const customer = await prisma.customer.create({
                data: {
                    nama: input.nama,
                    no_hp: input.no_hp || null,
                    email: input.email || null,
                    alamat: input.alamat || null,
                },
            });

            return customer;
        }),

    update: t.procedure
        .input(
            z.object({
                id: z.string(),
                nama: z.string().min(1, "Nama is required"),
                no_hp: z.string().optional(),
                email: z.string().email().optional().or(z.literal("")),
                alamat: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const customer = await prisma.customer.update({
                where: { id: input.id },
                data: {
                    nama: input.nama,
                    no_hp: input.no_hp || null,
                    email: input.email || null,
                    alamat: input.alamat || null,
                },
            });

            return customer;
        }),

    delete: t.procedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.customer.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
