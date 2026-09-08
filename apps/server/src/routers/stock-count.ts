import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  approveStockCountSchema,
  createStockCountSchema,
  saveStockCountLinesSchema,
  stockCountIdSchema,
  transitionStockCountSchema,
} from '@repo/schemas/stock-count';
import { getNextDocumentNumberByCode } from '../lib/document-number.js';
import { logActivity } from '../lib/activity-log.js';
import { buildPaginationMeta, buildPaginationParams, createListInputSchema } from '../lib/list-query.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';
import { buildApprovalActionData } from '../lib/transaction.js';

const includeStockCount = {
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  countedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      sku: { select: { id: true, code: true, name: true, baseUnit: true } },
      pallet: { select: { id: true, palletNumber: true, lotNo: true, expiryDate: true } },
    },
  },
};

/** Snapshot all AVAILABLE pallets in the warehouse as count lines. */
const generateCountLines = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  stockCountId: string,
  warehouseId: string,
  skuIds?: string[],
) => {
  const pallets = await tx.pallet.findMany({
    where: {
      status: 'AVAILABLE',
      storageLocation: { warehouseId },
      ...(skuIds && skuIds.length > 0 ? { skuId: { in: skuIds } } : {}),
    },
    select: { id: true, skuId: true, storageLocationId: true },
  });

  if (pallets.length === 0) return 0;

  await tx.stockCountLine.createMany({
    data: pallets.map((pallet) => ({
      stockCountId,
      skuId: pallet.skuId,
      palletId: pallet.id,
      storageLocationId: pallet.storageLocationId,
      systemQty: 1,
    })),
  });

  return pallets.length;
};

export const stockCountRouter = router({
  list: protectedProcedure
    .use(hasPermission('stock_count@read'))
    .input(
      createListInputSchema({
        warehouseId: z.string().optional(),
        status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const where = {
        ...(input?.warehouseId && { warehouseId: input.warehouseId }),
        ...(input?.status && { status: input.status }),
        ...(input?.search && { documentNumber: { contains: input.search, mode: 'insensitive' as const } }),
      };

      const [data, total] = await Promise.all([
        prisma.stockCount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            ...includeStockCount,
            lines: { select: { id: true, countedQty: true, variance: true } },
          },
        }),
        prisma.stockCount.count({ where }),
      ]);

      return {
        data: data.map((count) => ({
          ...count,
          totalLines: count.lines.length,
          countedLines: count.lines.filter((line) => line.countedQty !== null).length,
          varianceLines: count.lines.filter((line) => line.variance !== null && line.variance.toNumber() !== 0).length,
        })),
        pagination: buildPaginationMeta({ page, limit, total }),
      };
    }),

  detail: protectedProcedure
    .use(hasPermission('stock_count@read'))
    .input(stockCountIdSchema)
    .query(async ({ input }) => {
      const count = await prisma.stockCount.findUnique({
        where: { id: input.id },
        include: includeStockCount,
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      return count;
    }),

  /** Create a count session and snapshot system quantities. Requires stock_count@create. */
  create: protectedProcedure
    .use(hasPermission('stock_count@create'))
    .use(transactional)
    .input(createStockCountSchema)
    .mutation(async ({ input, ctx }) => {
      const documentNumber = await getNextDocumentNumberByCode(ctx.db, {
        code: 'CNT',
        model: 'stockCount',
        warehouseId: input.warehouseId,
        date: new Date(),
      });

      const created = await ctx.db.stockCount.create({
        data: {
          documentNumber,
          warehouseId: input.warehouseId,
          isBlindCount: input.isBlindCount,
          notes: input.notes ?? null,
          createdById: ctx.user!.userId,
          status: 'IN_PROGRESS',
        },
      });

      const lineCount = await generateCountLines(ctx.db, created.id, input.warehouseId, input.skuIds);

      if (lineCount === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No available pallets to count in this warehouse' });
      }

      await logActivity(ctx.db, {
        action: 'CREATE',
        userId: ctx.user!.userId,
        resource: 'stock_count',
        resourceId: created.id,
        message: `Created stock count ${documentNumber} with ${lineCount} lines`,
        detail: { warehouseId: input.warehouseId, isBlindCount: input.isBlindCount, lineCount },
      });

      return created;
    }),

  /** Add an extra count line (stock found that is not in the system). Requires stock_count@update. */
  addExtraLine: protectedProcedure
    .use(hasPermission('stock_count@update'))
    .use(transactional)
    .input(z.object({
      id: z.string().min(1),
      skuId: z.string().min(1),
      countedQty: z.number().min(1),
      details: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const count = await ctx.db.stockCount.findUnique({ where: { id: input.id } });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      if (count.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count is not open for entry' });
      }

      const line = await ctx.db.stockCountLine.create({
        data: {
          stockCountId: count.id,
          skuId: input.skuId,
          systemQty: 0,
          countedQty: input.countedQty,
          variance: input.countedQty,
          countedAt: new Date(),
        },
      });

      await logActivity(ctx.db, {
        action: 'CREATE',
        userId: ctx.user!.userId,
        resource: 'stock_count_line',
        resourceId: line.id,
        message: `Added extra count line (found ${input.countedQty}) to ${count.documentNumber}`,
      });

      return line;
    }),

  /** Save counted quantities. Requires stock_count@update. */
  saveCounts: protectedProcedure
    .use(hasPermission('stock_count@update'))
    .use(transactional)
    .input(saveStockCountLinesSchema)
    .mutation(async ({ input, ctx }) => {
      const count = await ctx.db.stockCount.findUnique({ where: { id: input.id } });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      if (count.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count is not open for entry' });
      }

      for (const line of input.lines) {
        const existing = await ctx.db.stockCountLine.findFirst({
          where: { id: line.lineId, stockCountId: input.id },
        });
        if (!existing) continue;
        await ctx.db.stockCountLine.update({
          where: { id: line.lineId },
          data: {
            countedQty: line.countedQty,
            variance: line.countedQty - existing.systemQty.toNumber(),
            countedAt: new Date(),
          },
        });
      }

      await ctx.db.stockCount.update({
        where: { id: input.id },
        data: { countedById: ctx.user!.userId },
      });

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'stock_count',
        resourceId: input.id,
        message: `Saved ${input.lines.length} counted lines for ${count.documentNumber}`,
      });

      return { success: true };
    }),

  /** Transition status: DRAFT/IN_PROGRESS → CANCELLED. Requires stock_count@update. */
  transition: protectedProcedure
    .use(hasPermission('stock_count@update'))
    .use(transactional)
    .input(transitionStockCountSchema)
    .mutation(async ({ input, ctx }) => {
      const count = await ctx.db.stockCount.findUnique({ where: { id: input.id } });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      if (count.status === 'COMPLETED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Completed counts cannot change status' });
      }

      const updated = await ctx.db.stockCount.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'stock_count',
        resourceId: input.id,
        message: `Stock count ${count.documentNumber} → ${input.status}`,
      });

      return updated;
    }),

  /**
   * Approve the count and generate reconciliation documents:
   * negative variances → LossTransaction (DRAFT), positive extras →
   * FoundTransaction (DRAFT). The generated documents follow the normal
   * approval flow. Requires stock_count@approve.
   */
  approve: protectedProcedure
    .use(hasPermission('stock_count@approve'))
    .use(transactional)
    .input(approveStockCountSchema)
    .mutation(async ({ input, ctx }) => {
      const count = await ctx.db.stockCount.findUnique({
        where: { id: input.id },
        include: { lines: { include: { sku: true, pallet: { select: { palletNumber: true } } } } },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      if (count.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only in-progress counts can be approved' });
      }

      const varianceLines = count.lines.filter(
        (line) => line.countedQty !== null && line.variance !== null && line.variance.toNumber() !== 0,
      );
      const shortageLines = varianceLines.filter((line) => line.variance!.toNumber() < 0);
      const surplusLines = varianceLines.filter((line) => line.variance!.toNumber() > 0);

      const generated: { type: 'LOSS' | 'FOUND'; documentNumber: string | null; id: string }[] = [];

      if (shortageLines.length > 0) {
        const documentNumber = await getNextDocumentNumberByCode(ctx.db, {
          code: 'LOS',
          model: 'lossTransaction',
          warehouseId: count.warehouseId,
          date: new Date(),
        });
        const loss = await ctx.db.lossTransaction.create({
          data: {
            documentNumber,
            warehouseId: count.warehouseId,
            lossReason: 'Cycle count variance',
            reference: count.documentNumber,
            notes: `Auto-generated from stock count ${count.documentNumber}`,
            createdById: ctx.user!.userId,
            sourceType: 'STOCK_COUNT',
            sourceId: count.id,
            approvalHistory: [
              { process: 'GENERATED', userName: ctx.user!.name ?? ctx.user!.email, timeframe: new Date().toISOString(), message: `Generated from stock count ${count.documentNumber}` },
            ],
            approvalStatus: 'DRAFT',
            items: {
              create: shortageLines.map((line) => ({
                skuId: line.skuId,
                quantity: Math.abs(line.variance!.toNumber()),
                details: `Count variance for pallet ${line.pallet?.palletNumber ?? '—'}`,
              })),
            },
          },
        });
        generated.push({ type: 'LOSS', id: loss.id, documentNumber: loss.documentNumber });
      }

      if (surplusLines.length > 0) {
        const documentNumber = await getNextDocumentNumberByCode(ctx.db, {
          code: 'FND',
          model: 'foundTransaction',
          warehouseId: count.warehouseId,
          date: new Date(),
        });
        const found = await ctx.db.foundTransaction.create({
          data: {
            documentNumber,
            warehouseId: count.warehouseId,
            foundReason: 'Cycle count variance',
            reference: count.documentNumber,
            notes: `Auto-generated from stock count ${count.documentNumber}`,
            createdById: ctx.user!.userId,
            sourceType: 'STOCK_COUNT',
            sourceId: count.id,
            approvalHistory: [
              { process: 'GENERATED', userName: ctx.user!.name ?? ctx.user!.email, timeframe: new Date().toISOString(), message: `Generated from stock count ${count.documentNumber}` },
            ],
            approvalStatus: 'DRAFT',
            items: {
              create: surplusLines.map((line) => ({
                skuId: line.skuId,
                quantity: line.variance!.toNumber(),
                details: `Count surplus`,
              })),
            },
          },
        });
        generated.push({ type: 'FOUND', id: found.id, documentNumber: found.documentNumber });
      }

      const approved = await ctx.db.stockCount.update({
        where: { id: input.id },
        data: {
          status: 'COMPLETED',
          approvedById: ctx.user!.userId,
          approvedAt: new Date(),
          approvalHistory: buildApprovalActionData(count.approvalHistory, ctx.user!, 'APPROVED', input.message).approvalHistory,
        },
        include: includeStockCount,
      });

      await logActivity(ctx.db, {
        action: 'APPROVE',
        userId: ctx.user!.userId,
        resource: 'stock_count',
        resourceId: input.id,
        message: `Approved stock count ${count.documentNumber}; generated ${generated.length} adjustment document(s)`,
        detail: { generated },
      });

      return { count: approved, generated };
    }),

  /** Delete a DRAFT/CANCELLED count. Requires stock_count@delete. */
  delete: protectedProcedure
    .use(hasPermission('stock_count@delete'))
    .use(transactional)
    .input(stockCountIdSchema)
    .mutation(async ({ input, ctx }) => {
      const count = await ctx.db.stockCount.findUnique({ where: { id: input.id } });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock count not found' });
      if (count.status === 'COMPLETED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Completed counts cannot be deleted' });
      }

      await ctx.db.stockCount.delete({ where: { id: input.id } });

      await logActivity(ctx.db, {
        action: 'DELETE',
        userId: ctx.user!.userId,
        resource: 'stock_count',
        resourceId: input.id,
        message: `Deleted stock count ${count.documentNumber}`,
      });

      return { success: true };
    }),
});
