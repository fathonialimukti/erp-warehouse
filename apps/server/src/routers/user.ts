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
    logUserMutation,
    userMutationSelect,
} from '../lib/user-mutation-service.js';
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from '../lib/log-detail.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';
import { createUserSchema, updateUserSchema, userIdSchema } from '@repo/schemas/user';

export const userRouter = router({
    list: protectedProcedure.use(hasPermission('user@read'))
        .input(createListInputSchema({ roleId: z.string().optional() }))
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;
            const roleId = input?.roleId;

            const where = {
                ...buildTextSearchWhere(search, ['name', 'email'] as const),
                ...(roleId && { roleId }),
            };

            const data = await prisma.user.findMany({
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
            });
            const total = await prisma.user.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure.use(hasPermission('user@read'))
        .input(userIdSchema)
        .query(async ({ input, ctx }) => {
            return getUserDetailOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
        }),

    create: protectedProcedure.use(hasPermission('user@create'))
        .input(createUserSchema)
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
                detail: buildCreateLogDetail(user),
            });

            return user;
        }),

    update: protectedProcedure.use(hasPermission('user@update'))
        .input(updateUserSchema)
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

            const existingUser = await getUserDetailOrThrow({ db: prisma, id, locale: ctx.locale });

            const updateData = await buildUpdateUserData({
                input: { ...data, password, photo },
                existingPhoto: existingUser.photo,
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
                detail: buildUpdateLogDetail(existingUser, user),
            });

            return user;
        }),

    delete: protectedProcedure.use(hasPermission('user@delete')).use(transactional)
        .input(userIdSchema)
        .mutation(async ({ input, ctx }) => {
            const user = await getUserDeletionStateOrThrow({ db: ctx.db, id: input.id, locale: ctx.locale });
            await ensureUserDeletionAllowed({ db: ctx.db, locale: ctx.locale, user });

            await ctx.db.user.delete({
                where: { id: input.id },
            });

            await removePhotoValue(user?.photo ?? null);

            await logUserMutation({
                db: ctx.db,
                action: 'DELETE',
                actorUserId: ctx.user!.userId,
                targetUserId: input.id,
                targetUserName: user?.name ?? 'unknown',
                detail: buildDeleteLogDetail(user),
            });

            return { success: true };
        }),
});
