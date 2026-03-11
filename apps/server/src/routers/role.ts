import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const roleRouter = router({
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
                prisma.role.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                }),
                prisma.role.count({ where }),
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
            const role = await prisma.role.findUnique({
                where: { id: input.id },
                include: {
                    permissions: {
                        include: { permission: true },
                    },
                },
            });

            if (!role) {
                throw new Error("Role not found");
            }

            return role;
        }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                permissions: z.array(z.string()).optional(),
            })
        )
        .mutation(async ({ input }) => {
            const role = await prisma.role.create({
                data: {
                    name: input.name,
                    description: input.description || null,
                    permissions: {
                        create: (input.permissions || []).map((permissionId) => ({
                            permissionId,
                        })),
                    },
                },
                include: {
                    permissions: {
                        include: { permission: true },
                    },
                },
            });

            return role;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                permissions: z.array(z.string()).optional(),
            })
        )
        .mutation(async ({ input }) => {
            // Delete existing permissions
            await prisma.roleHasPermission.deleteMany({
                where: { roleId: input.id },
            });

            const role = await prisma.role.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description || null,
                    permissions: {
                        create: (input.permissions || []).map((permissionId) => ({
                            permissionId,
                        })),
                    },
                },
                include: {
                    permissions: {
                        include: { permission: true },
                    },
                },
            });

            return role;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.role.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
