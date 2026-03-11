import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const permissionRouter = router({
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
                        { name: { contains: search, mode: "insensitive" as const } },
                        { description: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.permission.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.permission.count({ where }),
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
            const permission = await prisma.permission.findUnique({
                where: { id: input.id },
            });

            if (!permission) {
                throw new Error("Permission not found");
            }

            return permission;
        }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const permission = await prisma.permission.create({
                data: {
                    name: input.name,
                    description: input.description || null,
                },
            });

            return permission;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const permission = await prisma.permission.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description || null,
                },
            });

            return permission;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.permission.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
