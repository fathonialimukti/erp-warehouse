import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import type { DbClient } from "../lib/prisma.js";

const pickLineStatusValues = ['PENDING', 'COMPLETED'] as const;

const dispatchListInputSchema = z.object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(200).optional(),
    search: z.string().optional(),
    documentId: z.string().optional(),
    transactionType: z.string().optional(),
    status: z.enum(pickLineStatusValues).optional(),
});

const includePickLine = {
    pallet: {
        include: {
            palletType: true,
            storageLocation: { select: { id: true, warehouseId: true } },
        },
    },
    fromLocation: { select: { id: true, warehouseId: true } },
    assignedBy: { select: { id: true, name: true } },
    completedBy: { select: { id: true, name: true } },
} as const;

// Update the parent document dispatchStatus after completing a pick line
async function syncDispatchStatus(db: DbClient, transactionType: string, documentId: string): Promise<void> {
    const total = await db.pickLine.count({ where: { documentId, transactionType: transactionType as never } });
    const completed = await db.pickLine.count({ where: { documentId, transactionType: transactionType as never, status: 'COMPLETED' } });

    const newStatus = completed === 0 ? 'PENDING' : completed === total ? 'COMPLETED' : 'PARTIAL';

    switch (transactionType) {
        case 'WIP_ISSUE':
            await db.wipIssue.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case 'SHIPMENT':
            await db.shipment.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case 'RETURN_TO_SUPPLIER':
            await db.returnToSupplier.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case 'DISPOSAL':
            await db.disposal.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        default:
            break;
    }
}

export const dispatchRouter = router({
    list: protectedProcedure.use(hasPermission('dispatch@read')).input(dispatchListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...(input?.documentId ? { documentId: input.documentId } : {}),
            ...(input?.transactionType ? { transactionType: input.transactionType } : {}),
            ...(input?.status ? { status: input.status } : {}),
            ...(search ? {
                OR: [
                    { documentId: { contains: search, mode: 'insensitive' as const } },
                    { id: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const rows = await ctx.db.pickLine.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: includePickLine,
        });
        const total = await ctx.db.pickLine.count({ where });

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('dispatch@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.pickLine.findUnique({ where: { id: input.id }, include: includePickLine });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'dispatch.notFound') });
        }
        return row;
    }),

    complete: protectedProcedure.use(hasPermission('dispatch@complete')).use(transactional)
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const line = await ctx.db.pickLine.findUnique({
                where: { id: input.id },
                include: { pallet: { select: { id: true, storageLocationId: true } } },
            });
            if (!line) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'dispatch.notFound') });
            }
            if (line.status === 'COMPLETED') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'dispatch.alreadyCompleted') });
            }

            // Clear pallet from its storage location (pallet leaves warehouse)
            await ctx.db.pallet.update({
                where: { id: line.palletId },
                data: { storageLocationId: null },
            });

            // Complete the pick line
            const completed = await ctx.db.pickLine.update({
                where: { id: input.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    completedById: ctx.user!.userId,
                },
                include: includePickLine,
            });

            // Sync parent document dispatchStatus
            await syncDispatchStatus(ctx.db, line.transactionType, line.documentId);

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'pick_line',
                resourceId: completed.id,
                message: `Menyelesaikan dispatch ${completed.id}`,
                detail: {
                    before: { status: line.status, storageLocationId: line.pallet.storageLocationId ?? null },
                    after: { status: 'COMPLETED', storageLocationId: null },
                },
            });

            return completed;
        }),
});
