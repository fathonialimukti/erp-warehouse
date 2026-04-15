import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { buildPaginationMeta, buildPaginationParams, createPaginationInputSchema } from '../lib/list-query.js';
import { prisma } from '../lib/prisma.js';
import { getMessage } from '../lib/locale.js';
import { protectedProcedure, router } from '../trpc.js';

export const notificationRouter = router({
  list: protectedProcedure
    .input(createPaginationInputSchema({ unreadOnly: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const unreadOnly = input?.unreadOnly ?? false;

      const where = {
        userId: ctx.user.userId,
        ...(unreadOnly && { isRead: false }),
      };

      const [data, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: limit,
          include: {
            createdBy: {
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
        prisma.notification.count({ where }),
      ]);

      return {
        data,
        pagination: buildPaginationMeta({ page, limit, total }),
      };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const notif = await prisma.notification.findUnique({
        where: { id: input.id },
      });

      if (!notif) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: getMessage(ctx.locale, 'notification.notFound'),
        });
      }

      if (notif.userId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: getMessage(ctx.locale, 'notification.noAccess'),
        });
      }

      return prisma.notification.update({
        where: { id: input.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    return prisma.notification.updateMany({
      where: {
        userId: ctx.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.notification.count({
      where: {
        userId: ctx.user.userId,
        isRead: false,
      },
    });

    return { count };
  }),
});
