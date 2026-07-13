import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/activity-log.js';
import { buildPaginationMeta, buildPaginationParams, createPaginationInputSchema } from '../lib/list-query.js';
import { prisma } from '../lib/prisma.js';
import { getMessage } from '../lib/locale.js';
import { sseManager } from '../lib/sse-manager.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';

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

      return updatedNotification;
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
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

  // ─── Admin procedures ──────────────────────────────────────────────────────

  /** List ALL users' notifications. Requires notification@read. */
  listAll: protectedProcedure
    .use(hasPermission('notification@read'))
    .input(
      createPaginationInputSchema({
        userId: z.string().optional(),
        type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).optional(),
        targetType: z
          .enum(['SYSTEM', 'RECEIVING', 'WIP_COMPLETION', 'RMA_RECEIPT', 'WIP_ISSUE', 'SHIPMENT', 'RETURN_TO_SUPPLIER', 'DISPOSAL', 'SUBINVENTORY_TRANSFER', 'LOSS', 'FOUND'])
          .optional(),
        isRead: z.boolean().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);

      const where = {
        ...(input?.userId && { userId: input.userId }),
        ...(input?.type && { type: input.type }),
        ...(input?.targetType && { targetType: input.targetType }),
        ...(typeof input?.isRead === 'boolean' && { isRead: input.isRead }),
        ...(input?.dateFrom || input?.dateTo
          ? {
              createdAt: {
                ...(input.dateFrom && { gte: new Date(input.dateFrom) }),
                ...(input.dateTo && { lte: new Date(input.dateTo) }),
              },
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
      ]);

      return { data, pagination: buildPaginationMeta({ page, limit, total }) };
    }),

  /** Delete a single notification. Requires notification@delete. */
  deleteById: protectedProcedure
    .use(hasPermission('notification@delete'))
    .use(transactional)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const notif = await ctx.db.notification.findUnique({ where: { id: input.id } });
      if (!notif) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'notification.notFound') });
      }

      await ctx.db.notification.delete({ where: { id: input.id } });

      await logActivity(ctx.db, {
        action: 'DELETE',
        userId: ctx.user!.userId,
        resource: 'notification',
        resourceId: input.id,
        message: `Admin deleted notification ${input.id}`,
        detail: { deleted: notif },
      });

      return { success: true };
    }),

  /**
   * Re-push an existing notification via SSE (no new DB row).
   * Requires notification@read.
   */
  resend: protectedProcedure
    .use(hasPermission('notification@read'))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const notif = await prisma.notification.findUnique({
        where: { id: input.id },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });
      if (!notif) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'notification.notFound') });
      }

      sseManager.broadcast(notif.userId, { type: 'notification', payload: notif });

      await logActivity(prisma, {
        action: 'UPDATE',
        userId: ctx.user.userId,
        resource: 'notification',
        resourceId: notif.id,
        message: `Admin resent push for notification ${notif.id} to user ${notif.userId}`,
      });

      return { success: true };
    }),

  /**
   * Compose and send a new notification to selected users or all users.
   * Requires notification@broadcast.
   */
  broadcast: protectedProcedure
    .use(hasPermission('notification@broadcast'))
    .input(
      z.object({
        /** Explicit recipient list. Pass empty array when sendToAll is true. */
        userIds: z.array(z.string()).default([]),
        /** If true, sends to every user in the system (overrides userIds). */
        sendToAll: z.boolean().default(false),
        title: z.string().min(1),
        message: z.string().min(1),
        link: z.string().optional(),
        type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).default('INFO'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let recipientIds: string[];

      if (input.sendToAll) {
        const users = await prisma.user.findMany({ select: { id: true } });
        recipientIds = users.map((u) => u.id);
      } else {
        recipientIds = input.userIds;
      }

      if (recipientIds.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No recipients specified.' });
      }

      const created = await Promise.all(
        recipientIds.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              createdById: ctx.user.userId,
              title: input.title,
              message: input.message,
              actionUrl: input.link ?? null,
              type: input.type,
              targetType: 'SYSTEM',
            },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          })
        )
      );

      for (const notif of created) {
        sseManager.broadcast(notif.userId, { type: 'notification', payload: notif });
      }

      await logActivity(prisma, {
        action: 'CREATE',
        userId: ctx.user.userId,
        resource: 'notification',
        resourceId: ctx.user.userId,
        message: `Admin broadcast "${input.title}" to ${created.length} user(s)`,
        detail: { recipientCount: created.length, sendToAll: input.sendToAll },
      });

      return { count: created.length };
    }),
});
