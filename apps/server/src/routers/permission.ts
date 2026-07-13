import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/activity-log.js';
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from '../lib/list-query.js';
import { getMessage } from '../lib/locale.js';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router, hasPermission, transactional } from '../trpc.js';

const getPermissionOrThrow = async (id: string, locale: 'en' | 'id') => {
    const permission = await prisma.permission.findUnique({
        where: { id },
    });

    if (!permission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(locale, 'permission.notFound') });
    }

    return permission;
};

const buildPermissionNameDiff = (beforeName: string, afterName: string) => {
    if (beforeName === afterName) {
        return { add: [], remove: [] };
    }

    return { add: [afterName], remove: [beforeName] };
};

export const permissionRouter = router({
    listAll: protectedProcedure
        .use(hasPermission('permission@read'))
        .query(async () => {
            return prisma.permission.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });
        }),

    list: protectedProcedure
        .use(hasPermission('permission@read'))
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ['name', 'description'] as const);

            const data = await prisma.permission.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            });
            const total = await prisma.permission.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .use(hasPermission('permission@read'))
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            return getPermissionOrThrow(input.id, ctx.locale);
        }),

    create: protectedProcedure
        .use(hasPermission('permission@create'))
        .use(transactional)
        .input(
            z.object({
                name: z.string().min(1, 'Name is required'),
                description: z.string().optional(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const permission = await ctx.db.permission.create({
                data: {
                    name: input.name,
                    description: input.description || null,
                },
            });

            await logActivity(ctx.db, {
                action: 'CREATE',
                userId: ctx.user!.userId,
                resource: 'permission',
                resourceId: permission.id,
                message: `Created permission ${permission.name}`,
                detail: {
                    add: [permission.name],
                },
            });

            return permission;
        }),

    update: protectedProcedure
        .use(hasPermission('permission@update'))
        .use(transactional)
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1, 'Name is required'),
                description: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const existingPermission = await getPermissionOrThrow(input.id, ctx.locale);

            const permission = await ctx.db.permission.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description || null,
                },
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'permission',
                resourceId: permission.id,
                message: `Updated permission ${permission.name}`,
                detail: buildPermissionNameDiff(existingPermission.name, permission.name),
            });

            return permission;
        }),

    delete: protectedProcedure
        .use(hasPermission('permission@delete'))
        .use(transactional)
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const existingPermission = await getPermissionOrThrow(input.id, ctx.locale);

            await ctx.db.permission.delete({ where: { id: input.id } });

            await logActivity(ctx.db, {
                action: 'DELETE',
                userId: ctx.user!.userId,
                resource: 'permission',
                resourceId: existingPermission.id,
                message: `Deleted permission ${existingPermission.name}`,
                detail: {
                    add: [existingPermission.name],
                },
            });

            return { success: true };
        }),
});