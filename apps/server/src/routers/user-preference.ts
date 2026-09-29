import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

const updateSchema = z.object({
  notifyInApp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  defaultWarehouseId: z.string().nullish(),
  pageSize: z.number().int().min(5).max(100).optional(),
});

export const userPreferenceRouter = router({
  /** Current user's preferences (creates the row on first access). */
  get: protectedProcedure.query(async ({ ctx }) => {
    const existing = await prisma.userPreference.findUnique({
      where: { userId: ctx.user.userId },
    });
    if (existing) return existing;
    return prisma.userPreference.create({ data: { userId: ctx.user.userId } });
  }),

  /** Update the current user's preferences (self-service, no permission needed). */
  update: protectedProcedure
    .input(updateSchema)
    .mutation(async ({ ctx, input }) => {
      return prisma.userPreference.upsert({
        where: { userId: ctx.user.userId },
        update: {
          ...(input.notifyInApp !== undefined && {
            notifyInApp: input.notifyInApp,
          }),
          ...(input.notifyEmail !== undefined && {
            notifyEmail: input.notifyEmail,
          }),
          ...(input.defaultWarehouseId !== undefined && {
            defaultWarehouseId: input.defaultWarehouseId ?? null,
          }),
          ...(input.pageSize !== undefined && { pageSize: input.pageSize }),
        },
        create: {
          userId: ctx.user.userId,
          ...(input.notifyInApp !== undefined && {
            notifyInApp: input.notifyInApp,
          }),
          ...(input.notifyEmail !== undefined && {
            notifyEmail: input.notifyEmail,
          }),
          ...(input.defaultWarehouseId !== undefined && {
            defaultWarehouseId: input.defaultWarehouseId ?? null,
          }),
          ...(input.pageSize !== undefined && { pageSize: input.pageSize }),
        },
      });
    }),
});
