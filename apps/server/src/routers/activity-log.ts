import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const activityLogRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    userId: z.string().optional(),
                    resource: z.string().optional(),
                    action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT']).optional(),
                    startDate: z.string().optional(),
                    endDate: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.userId && { userId: input.userId }),
                ...(input?.resource && { resource: input.resource }),
                ...(input?.action && { action: input.action }),
                ...(input?.startDate || input?.endDate ? {
                    createdAt: {
                        ...(input.startDate && { gte: new Date(input.startDate) }),
                        ...(input.endDate && { lte: new Date(input.endDate) }),
                    },
                } : {}),
            };

            const [data, total] = await Promise.all([
                prisma.activityLog.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                }),
                prisma.activityLog.count({ where }),
            ]);

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string().min(1, 'ID is required') }))
        .query(async ({ input }) => {
            const item = await prisma.activityLog.findUnique({
                where: { id: input.id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!item) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity log not found' });
            }

            return item;
        }),
});