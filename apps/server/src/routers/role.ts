import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/activity-log.js';
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from '../lib/list-query.js';
import { getMessage } from '../lib/locale.js';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router, hasPermission } from '../trpc.js';

const getRoleOrThrow = async (id: string, locale: 'en' | 'id') => {
    const role = await prisma.role.findUnique({
        where: { id },
        include: {
            permissions: {
                include: { permission: true },
            },
        },
    });

    if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(locale, 'role.notFound') });
    }

    return role;
};

export const roleRouter = router({
    listAll: protectedProcedure
        .use(hasPermission('role_read'))
        .query(async () => {
            return prisma.role.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });
        }),

    list: protectedProcedure
        .use(hasPermission('role_read'))
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ['name', 'description'] as const);

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
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .use(hasPermission('role_read'))
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            return getRoleOrThrow(input.id, ctx.locale);
        }),

    create: protectedProcedure
        .use(hasPermission('role_create'))
        .input(
            z.object({
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                permissions: z.array(z.string()).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
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

            await logActivity(prisma, {
                action: 'CREATE',
                userId: ctx.user.userId,
                resource: 'role',
                resourceId: role.id,
                message: `Created role ${role.name}`,
                detail: {
                    data: role,
                },
            });

            return role;
        }),

    update: protectedProcedure
        .use(hasPermission('role_update'))
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                permissions: z.array(z.string()).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const existingRole = await getRoleOrThrow(input.id, ctx.locale);

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

            await logActivity(prisma, {
                action: 'UPDATE',
                userId: ctx.user.userId,
                resource: 'role',
                resourceId: role.id,
                message: `Updated role ${role.name}`,
                detail: {
                    before: existingRole,
                    after: role,
                },
            });

            return role;
        }),

    delete: protectedProcedure
        .use(hasPermission('role_delete'))
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const existingRole = await getRoleOrThrow(input.id, ctx.locale);

            await prisma.role.delete({
                where: { id: input.id },
            });

            await logActivity(prisma, {
                action: 'DELETE',
                userId: ctx.user.userId,
                resource: 'role',
                resourceId: existingRole.id,
                message: `Deleted role ${existingRole.name}`,
                detail: {
                    latest: existingRole,
                },
            });

            return { success: true };
        }),
});
