import { z } from "zod";
import {
  buildPaginationMeta,
  buildPaginationParams,
  createListInputSchema,
} from "../lib/list-query.js";
import { prisma } from "../lib/prisma.js";
import { hasPermission, protectedProcedure, router } from "../trpc.js";

export const systemLogRouter = router({
  /** Paginated, filterable system logs. Requires log@read. */
  list: protectedProcedure
    .use(hasPermission("log@read"))
    .input(
      createListInputSchema({
        level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional(),
        source: z
          .enum(["http", "trpc", "app", "ai", "db", "mail", "rate-limit"])
          .optional(),
        requestId: z.string().optional(),
        userId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);

      const where = {
        ...(input?.search && {
          message: { contains: input.search, mode: "insensitive" as const },
        }),
        ...(input?.source && { source: input.source }),
        ...(input?.requestId && { requestId: input.requestId }),
        ...(input?.userId && { userId: input.userId }),
        ...(input?.level && { level: input.level }),
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
        prisma.systemLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.systemLog.count({ where }),
      ]);

      return { data, pagination: buildPaginationMeta({ page, limit, total }) };
    }),

  /** Level/source options for filter dropdowns. Requires log@read. */
  stats: protectedProcedure.use(hasPermission("log@read")).query(async () => {
    const [total, errorCount, warnCount] = await Promise.all([
      prisma.systemLog.count(),
      prisma.systemLog.count({ where: { level: "ERROR" } }),
      prisma.systemLog.count({ where: { level: "WARN" } }),
    ]);
    return { total, errorCount, warnCount };
  }),
});
