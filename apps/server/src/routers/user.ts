import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { deleteManagedUpload, persistUploadedImage } from '../lib/upload-file.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { protectedProcedure, router } from '../trpc.js';

export const userRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                    roleId: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const roleId = input?.roleId;
            const skip = (page - 1) * limit;

            const where = {
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' as const } },
                        { email: { contains: search, mode: 'insensitive' as const } },
                    ],
                }),
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
            const user = await prisma.user.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    photo: true,
                    roleId: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!user) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'User not found',
                });
            }

            return user;
        }),

    create: protectedProcedure
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
            const existingUser = await prisma.user.findUnique({
                where: { email: input.email },
            });

            if (existingUser) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Email already exists',
                });
            }

            const hashedPassword = await hashPassword(input.password);
            const photo = input.photo
                ? await persistUploadedImage({ image: input.photo, folder: 'users', req: ctx.req })
                : null;

            const user = await prisma.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    password: hashedPassword,
                    roleId: input.roleId,
                    photo,
                },
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
            });

            return user;
        }),

    update: protectedProcedure
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
                const existingUser = await prisma.user.findUnique({
                    where: { email: data.email },
                });

                if (existingUser && existingUser.id !== id) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Email already exists',
                    });
                }
            }

            const existingUser = await prisma.user.findUnique({
                where: { id },
                select: { photo: true },
            });

            const updateData: {
                name?: string;
                email?: string;
                roleId?: string;
                password?: string;
                photo?: string | null;
            } = { ...data };
            if (password) {
                updateData.password = await hashPassword(password);
            }
            if (photo !== undefined) {
                updateData.photo = photo
                    ? await persistUploadedImage({ image: photo, folder: 'users', req: ctx.req })
                    : null;

                if (existingUser?.photo && existingUser.photo !== updateData.photo) {
                    await deleteManagedUpload(existingUser.photo);
                }
            }

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
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
            });

            return user;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            // Prevent deleting if user is the last system admin
            const user = await prisma.user.findUnique({
                where: { id: input.id },
                include: { role: true },
            });

            if (user?.role?.name === 'System Admin') {
                const adminCount = await prisma.user.count({
                    where: {
                        role: {
                            name: 'System Admin',
                        },
                    },
                });

                if (adminCount <= 1) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Cannot delete the last system admin',
                    });
                }
            }

            await prisma.user.delete({
                where: { id: input.id },
            });

            await deleteManagedUpload(user?.photo ?? null);

            return { success: true };
        }),
});
