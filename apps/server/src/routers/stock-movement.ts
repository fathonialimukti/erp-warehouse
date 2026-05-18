import { hasPermission, protectedProcedure, router } from "../trpc.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import { TRPCError } from "@trpc/server";
import { getMessage } from "../lib/locale.js";
import {
    stockMovementListInputSchema,
    stockMovementIdSchema,
} from "@repo/schemas/stock-movement";

const includeStockMovement = {
    sku: { select: { id: true, code: true, name: true } },
    palletType: { select: { id: true, name: true, weight: true } },
    warehouse: { select: { id: true, name: true, code: true } },
} as const;

export const stockMovementRouter = router({
    list: protectedProcedure.use(hasPermission('stock-movement@read')).input(stockMovementListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...(input?.skuId ? { skuId: input.skuId } : {}),
            ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
            ...(input?.transactionType ? { transactionType: input.transactionType } : {}),
            ...(input?.direction ? { direction: input.direction } : {}),
            ...(input?.dateFrom || input?.dateTo ? {
                transactionDate: {
                    ...(input?.dateFrom ? { gte: input.dateFrom } : {}),
                    ...(input?.dateTo ? { lte: input.dateTo } : {}),
                },
            } : {}),
            ...(search ? {
                OR: [
                    { documentId: { contains: search, mode: 'insensitive' as const } },
                    { documentNumber: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.stockMovement.findMany({ where, skip, take: limit, orderBy: { transactionDate: 'desc' }, include: includeStockMovement }),
            ctx.db.stockMovement.count({ where }),
        ]);

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('stock-movement@read')).input(stockMovementIdSchema).query(async ({ ctx, input }) => {
        const row = await ctx.db.stockMovement.findUnique({ where: { id: input.id }, include: includeStockMovement });
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'stockMovement.notFound') });
        return row;
    }),
});
