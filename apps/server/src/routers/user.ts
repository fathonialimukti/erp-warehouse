import { z } from 'zod';
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from '../lib/list-query.js';
import { removePhotoValue } from '../lib/photo-lifecycle.js';
import { prisma } from '../lib/prisma.js';
import {
    buildCreateUserData,
    buildUpdateUserData,
    ensureUserEmailAvailable,
    ensureUserDeletionAllowed,
    getUserDeletionStateOrThrow,
    getUserDetailOrThrow,
    getUserPhotoStateOrThrow,
    logUserMutation,
    userMutationSelect,
} from '../lib/user-mutation-service.js';
import { hasPermission, protectedProcedure, router } from '../trpc.js';

export const userRouter = router({
    list: protectedProcedure.use(hasPermission('user_read'))
        .input(createListInputSchema({ roleId: z.string().optional() }))
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;
            const roleId = input?.roleId;

            const where = {
                ...buildTextSearchWhere(search, ['name', 'email'] as const),
                ...(roleId && { roleId }),
            };

            const [data, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        photo: true,
                        role: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.user.count({ where }),
            ]);

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure.use(hasPermission('user_read'))
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return getUserDetailOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
        }),

    create: protectedProcedure.use(hasPermission('user_create'))
        .input(
            z.object({
                name: z.string().min(1, 'Name is required'),
                email: z.string().email('Invalid email'),
                password: z.string().min(6, 'Password must be at least 6 characters'),
                roleId: z.string().min(1, 'Role is required'),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            await ensureUserEmailAvailable({
                db: prisma,
                email: input.email,
                locale: ctx.locale,
            });

            const userData = await buildCreateUserData({
                input,
                req: ctx.req,
                locale: ctx.locale,
            });

            const user = await prisma.user.create({
                data: userData,
                select: userMutationSelect,
            });

            await logUserMutation({
                db: prisma,
                action: 'CREATE',
                actorUserId: ctx.user.userId,
                targetUserId: user.id,
                targetUserName: user.name ?? 'unknown',
            });

            return user;
        }),

    update: protectedProcedure.use(hasPermission('user_update'))
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1, 'Name is required').optional(),
                email: z.string().email('Invalid email').optional(),
                password: z.string().min(6, 'Password must be at least 6 characters').optional(),
                roleId: z.string().min(1, 'Role is required').optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { id, password, photo, ...data } = input;

            if (data.email) {
                await ensureUserEmailAvailable({
                    db: prisma,
                    email: data.email,
                    locale: ctx.locale,
                    excludeUserId: id,
                });
            }

            const existingUser = await getUserPhotoStateOrThrow({ db: prisma, id, locale: ctx.locale });

            const updateData = await buildUpdateUserData({
                input: { ...data, password, photo },
                existingPhoto: existingUser?.photo,
                req: ctx.req,
                locale: ctx.locale,
            });

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: userMutationSelect,
            });

            await logUserMutation({
                db: prisma,
                action: 'UPDATE',
                actorUserId: ctx.user.userId,
                targetUserId: user.id,
                targetUserName: user.name ?? 'unknown',
            });

            return user;
        }),

    delete: protectedProcedure.use(hasPermission('user_delete'))
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const user = await getUserDeletionStateOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
            await ensureUserDeletionAllowed({ db: prisma, locale: ctx.locale, user });

            await prisma.user.delete({
                where: { id: input.id },
            });

            await removePhotoValue(user?.photo ?? null);

            await logUserMutation({
                db: prisma,
                action: 'DELETE',
                actorUserId: ctx.user.userId,
                targetUserId: input.id,
                targetUserName: user?.name ?? 'unknown',
            });

            return { success: true };
        }),
});
