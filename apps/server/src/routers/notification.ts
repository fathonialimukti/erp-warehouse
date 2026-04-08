import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(10),
          unreadOnly: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;
      const unreadOnly = input?.unreadOnly ?? false;

      const where = {
        userId: ctx.user.userId,
        ...(unreadOnly && { isRead: false }),
        deletedAt: null,
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
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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
          message: 'Notifikasi tidak ditemukan',
        });
      }

      if (notif.userId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Anda tidak memiliki akses ke notifikasi ini',
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
        deletedAt: null,
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
        deletedAt: null,
      },
    });

    return { count };
  }),
});
