import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createPurchaseOrderSchema,
  poApprovalActionSchema,
  purchaseOrderIdSchema,
  updatePurchaseOrderSchema,
} from '@repo/schemas/purchase-order';
import { getNextDocumentNumberByCode } from '../lib/document-number.js';
import { logActivity } from '../lib/activity-log.js';
import { buildUpdateLogDetail, buildDeleteLogDetail, buildCreateLogDetail } from '../lib/log-detail.js';
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from '../lib/list-query.js';
import { prisma, type DbClient } from '../lib/prisma.js';
import { Prisma } from '../prisma/generated/client.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';
import { buildApprovalActionData } from '../lib/transaction.js';

const includePurchaseOrder = {
  supplier: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: [{ createdAt: 'asc' }] as Prisma.PurchaseOrderItemOrderByWithRelationInput[],
    include: { sku: { select: { id: true, code: true, name: true, baseUnit: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

const getPurchaseOrderOrThrow = async (db: DbClient, id: string) => {
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: includePurchaseOrder });
  if (!po) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
  return po;
};

export const purchaseOrderRouter = router({
  list: protectedProcedure
    .use(hasPermission('purchase_order@read'))
    .input(
      createListInputSchema({
        warehouseId: z.string().optional(),
        supplierId: z.string().optional(),
        status: z.enum(['DRAFT', 'PROPOSED', 'APPROVED', 'REJECTED', 'RECEIVING', 'CLOSED', 'CANCELLED']).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const where = {
        ...buildTextSearchWhere(input?.search, ['documentNumber']),
        ...(input?.warehouseId && { warehouseId: input.warehouseId }),
        ...(input?.supplierId && { supplierId: input.supplierId }),
        ...(input?.status && { status: input.status }),
      };

      const [data, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            ...includePurchaseOrder,
            items: { select: { quantity: true, receivedQty: true } },
          },
        }),
        prisma.purchaseOrder.count({ where }),
      ]);

      return {
        data: data.map((po) => ({
          ...po,
          totalItems: po.items.length,
          orderedQty: po.items.reduce((sum, item) => sum + item.quantity.toNumber(), 0),
          receivedQty: po.items.reduce((sum, item) => sum + item.receivedQty.toNumber(), 0),
        })),
        pagination: buildPaginationMeta({ page, limit, total }),
      };
    }),

  detail: protectedProcedure
    .use(hasPermission('purchase_order@read'))
    .input(purchaseOrderIdSchema)
    .query(async ({ input }) => getPurchaseOrderOrThrow(prisma, input.id)),

  create: protectedProcedure
    .use(hasPermission('purchase_order@create'))
    .use(transactional)
    .input(createPurchaseOrderSchema)
    .mutation(async ({ input, ctx }) => {
      const documentNumber = await getNextDocumentNumberByCode(ctx.db, {
        code: 'PO',
        model: 'purchaseOrder',
        warehouseId: input.warehouseId,
        date: new Date(),
      });

      const created = await ctx.db.purchaseOrder.create({
        data: {
          documentNumber,
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes ?? null,
          createdById: ctx.user!.userId,
          items: {
            create: input.items.map((item) => ({
              skuId: item.skuId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? null,
              details: item.details ?? null,
            })),
          },
        },
      });

      await logActivity(ctx.db, {
        action: 'CREATE',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: created.id,
        message: `Created purchase order ${documentNumber}`,
        detail: buildCreateLogDetail(created),
      });

      return created;
    }),

  update: protectedProcedure
    .use(hasPermission('purchase_order@update'))
    .use(transactional)
    .input(updatePurchaseOrderSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.purchaseOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft or rejected purchase orders can be edited' });
      }

      const updated = await ctx.db.purchaseOrder.update({
        where: { id: input.id },
        data: {
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes ?? null,
          ...(input.approvalStatus && { status: input.approvalStatus }),
          items: {
            deleteMany: {},
            create: input.items.map((item) => ({
              skuId: item.skuId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? null,
              details: item.details ?? null,
            })),
          },
        },
      });

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: updated.id,
        message: `Updated purchase order ${updated.documentNumber ?? updated.id}`,
        detail: buildUpdateLogDetail(existing, updated),
      });

      return updated;
    }),

  approve: protectedProcedure
    .use(hasPermission('purchase_order@approve'))
    .use(transactional)
    .input(poApprovalActionSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.purchaseOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (existing.status !== 'PROPOSED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only proposed purchase orders can be approved' });
      }

      const approvalData = buildApprovalActionData(existing.approvalHistory, ctx.user!, 'APPROVED', input.message);
      const approved = await ctx.db.purchaseOrder.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          approvedById: approvalData.approvedById,
          approvedAt: approvalData.approvedAt,
          approvalHistory: approvalData.approvalHistory,
        },
      });

      await logActivity(ctx.db, {
        action: 'APPROVE',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: input.id,
        message: `Approved purchase order ${existing.documentNumber ?? input.id}`,
        detail: { before: { status: existing.status }, approvalMessage: input.message ?? null },
      });

      return approved;
    }),

  reject: protectedProcedure
    .use(hasPermission('purchase_order@approve'))
    .use(transactional)
    .input(poApprovalActionSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.purchaseOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (existing.status !== 'PROPOSED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only proposed purchase orders can be rejected' });
      }

      await ctx.db.purchaseOrder.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          approvedById: ctx.user!.userId,
          approvedAt: new Date(),
          approvalHistory: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'REJECTED', input.message).approvalHistory,
        },
      });

      await logActivity(ctx.db, {
        action: 'REJECT',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: input.id,
        message: `Rejected purchase order ${existing.documentNumber ?? input.id}`,
        detail: { approvalMessage: input.message ?? null },
      });

      return { success: true };
    }),

  cancel: protectedProcedure
    .use(hasPermission('purchase_order@update'))
    .use(transactional)
    .input(purchaseOrderIdSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.purchaseOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (existing.status === 'CLOSED' || existing.status === 'CANCELLED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Purchase order is already closed' });
      }

      await ctx.db.purchaseOrder.update({ where: { id: input.id }, data: { status: 'CANCELLED' } });

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: input.id,
        message: `Cancelled purchase order ${existing.documentNumber ?? input.id}`,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .use(hasPermission('purchase_order@delete'))
    .use(transactional)
    .input(purchaseOrderIdSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await getPurchaseOrderOrThrow(ctx.db, input.id);
      if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED' && existing.status !== 'CANCELLED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft/rejected/cancelled purchase orders can be deleted' });
      }

      await ctx.db.purchaseOrder.delete({ where: { id: input.id } });

      await logActivity(ctx.db, {
        action: 'DELETE',
        userId: ctx.user!.userId,
        resource: 'purchase_order',
        resourceId: input.id,
        message: `Deleted purchase order ${existing.documentNumber ?? input.id}`,
        detail: buildDeleteLogDetail(existing),
      });

      return { success: true };
    }),

  /** Open purchase orders for the receiving flow picker. */
  openForReceiving: protectedProcedure
    .use(hasPermission('purchase_order@read'))
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['APPROVED', 'RECEIVING'] },
          ...(input.supplierId && { supplierId: input.supplierId }),
        },
        include: {
          items: {
            include: { sku: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return orders.map((po) => ({
        id: po.id,
        documentNumber: po.documentNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        status: po.status,
        items: po.items.map((item) => ({
          id: item.id,
          skuId: item.skuId,
          skuName: item.sku.name,
          orderedQty: item.quantity.toNumber(),
          receivedQty: item.receivedQty.toNumber(),
          outstandingQty: item.quantity.toNumber() - item.receivedQty.toNumber(),
        })),
      }));
    }),
});
