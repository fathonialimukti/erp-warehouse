import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/activity-log.js';
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

      const data = await prisma.notification.findMany({
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
      });
      const total = await prisma.notification.count({ where });

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

      const updatedNotification = await prisma.notification.update({
        where: { id: input.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      await logActivity(prisma, {
        action: 'UPDATE',
        userId: ctx.user.userId,
        resource: 'notification',
        resourceId: updatedNotification.id,
        message: `Marked notification ${updatedNotification.id} as read`,
        detail: {
          before: notif,
          after: updatedNotification,
        },
      });

      return updatedNotification;
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId: ctx.user.userId,
        isRead: false,
      },
    });

    const result = await prisma.notification.updateMany({
      where: {
        userId: ctx.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await logActivity(prisma, {
      action: 'UPDATE',
      userId: ctx.user.userId,
      resource: 'notification',
      resourceId: ctx.user.userId,
      message: 'Marked all notifications as read',
      detail: {
        updatedCount: result.count,
        notifications: unreadNotifications,
      },
    });

    return result;
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
