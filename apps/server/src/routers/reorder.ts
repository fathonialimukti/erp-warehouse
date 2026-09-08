import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { reorderListInputSchema, reorderPolicySchema } from '@repo/schemas/reorder';
import { getOnHandPalletCounts } from '../lib/reorder.js';
import { logActivity } from '../lib/activity-log.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';

export const reorderRouter = router({
  /**
   * Reorder dashboard: every policy joined with live on-hand pallet counts.
   * Status: below_min / below_reorder / ok. Requires reorder@read.
   */
  list: protectedProcedure
    .use(hasPermission('reorder@read'))
    .input(reorderListInputSchema)
    .query(async ({ input }) => {
      const policies = await prisma.skuReorderPolicy.findMany({
        where: { ...(input.warehouseId && { warehouseId: input.warehouseId }) },
        include: {
          sku: { select: { id: true, code: true, name: true, baseUnit: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          preferredSupplier: {
            select: {
              id: true,
              name: true,
              skus: { where: { isPreferred: true }, select: { leadTimeDays: true, minimumOrderQty: true, unitPrice: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const onHand = await getOnHandPalletCounts(prisma, input.warehouseId);
      const onHandMap = new Map(onHand.map((row) => [`${row.skuId}:${row.warehouseId}`, row.onHand]));

      const data = policies.map((policy) => {
        const count = onHandMap.get(`${policy.skuId}:${policy.warehouseId}`) ?? 0;
        const minQty = policy.minQty.toNumber();
        const reorderPoint = policy.reorderPoint.toNumber();
        const status = count < minQty ? 'below_min' : count < reorderPoint ? 'below_reorder' : 'ok';
        const preferredSku = policy.preferredSupplier?.skus[0];
        return {
          id: policy.id,
          sku: policy.sku,
          warehouse: policy.warehouse,
          minQty,
          maxQty: policy.maxQty.toNumber(),
          reorderPoint,
          onHand: count,
          status,
          suggestedQty: Math.max(policy.maxQty.toNumber() - count, 0),
          preferredSupplier: policy.preferredSupplier
            ? {
                id: policy.preferredSupplier.id,
                name: policy.preferredSupplier.name,
                leadTimeDays: preferredSku?.leadTimeDays ?? null,
                minimumOrderQty: preferredSku?.minimumOrderQty?.toNumber() ?? null,
                unitPrice: preferredSku?.unitPrice?.toNumber() ?? null,
              }
            : null,
        };
      });

      const filtered =
        input.status === 'all'
          ? data
          : data.filter((row) => row.status === input.status);

      const summary = {
        belowMin: data.filter((row) => row.status === 'below_min').length,
        belowReorder: data.filter((row) => row.status === 'below_reorder').length,
        ok: data.filter((row) => row.status === 'ok').length,
      };

      return { data: filtered, summary };
    }),

  /** Create or update the policy for a SKU + warehouse. Requires reorder@manage. */
  upsertPolicy: protectedProcedure
    .use(hasPermission('reorder@manage'))
    .use(transactional)
    .input(reorderPolicySchema)
    .mutation(async ({ input, ctx }) => {
      if (input.maxQty < input.minQty) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Max quantity must be greater than or equal to min quantity' });
      }

      const policy = await ctx.db.skuReorderPolicy.upsert({
        where: { skuId_warehouseId: { skuId: input.skuId, warehouseId: input.warehouseId } },
        update: {
          minQty: input.minQty,
          maxQty: input.maxQty,
          reorderPoint: input.reorderPoint,
          preferredSupplierId: input.preferredSupplierId ?? null,
        },
        create: {
          skuId: input.skuId,
          warehouseId: input.warehouseId,
          minQty: input.minQty,
          maxQty: input.maxQty,
          reorderPoint: input.reorderPoint,
          preferredSupplierId: input.preferredSupplierId ?? null,
        },
      });

      const included = await ctx.db.skuReorderPolicy.findUniqueOrThrow({
        where: { id: policy.id },
        include: { sku: { select: { name: true } }, warehouse: { select: { name: true } } },
      });

      await logActivity(ctx.db, {
        action: 'CREATE',
        userId: ctx.user!.userId,
        resource: 'sku_reorder_policy',
        resourceId: policy.id,
        message: `Upserted reorder policy for ${included.sku.name} @ ${included.warehouse.name}`,
        detail: { before: null, after: input },
      });

      return included;
    }),

  /** Delete a reorder policy. Requires reorder@manage. */
  deletePolicy: protectedProcedure
    .use(hasPermission('reorder@manage'))
    .use(transactional)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const policy = await ctx.db.skuReorderPolicy.findUnique({ where: { id: input.id } });
      if (!policy) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Reorder policy not found' });
      }
      await ctx.db.skuReorderPolicy.delete({ where: { id: input.id } });
      await logActivity(ctx.db, {
        action: 'DELETE',
        userId: ctx.user!.userId,
        resource: 'sku_reorder_policy',
        resourceId: input.id,
        message: 'Deleted reorder policy',
      });
      return { success: true };
    }),
});
