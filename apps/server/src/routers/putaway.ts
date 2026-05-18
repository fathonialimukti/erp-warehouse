import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import type { DbClient } from "../lib/prisma.js";

const putawayLineStatusValues = ['PENDING', 'COMPLETED'] as const;

const putawayListInputSchema = z.object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(200).optional(),
    search: z.string().optional(),
    documentId: z.string().optional(),
    transactionType: z.string().optional(),
    status: z.enum(putawayLineStatusValues).optional(),
    warehouseId: z.string().optional(),
});

const includePutawayLine = {
    pallet: {
        include: {
            palletType: true,
            storageLocation: { select: { id: true, code: true, name: true } },
        },
    },
    storageLocation: { select: { id: true, warehouseId: true } },
    completedBy: { select: { id: true, name: true } },
} as const;

// Update the parent document putawayStatus after completing a putaway line
async function syncPutawayStatus(db: DbClient, transactionType: string, documentId: string): Promise<void> {
    const total = await db.putawayLine.count({ where: { documentId, transactionType: transactionType as never } });
    const completed = await db.putawayLine.count({ where: { documentId, transactionType: transactionType as never, status: 'COMPLETED' } });

    const newStatus = completed === 0 ? 'PENDING' : completed === total ? 'COMPLETED' : 'PARTIAL';

    switch (transactionType) {
        case 'RECEIVING':
            await db.receivingTransaction.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case 'WIP_COMPLETION':
            await db.wipCompletion.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case 'RMA_RECEIPT':
            await db.rmaReceipt.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case 'FOUND':
            await db.foundTransaction.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        default:
            break;
    }
}

export const putawayRouter = router({
    list: protectedProcedure.use(hasPermission('putaway@read')).input(putawayListInputSchema).query(async ({ ctx, input }) => {
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

        const rows = await ctx.db.putawayLine.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: includePutawayLine,
        });
        const total = await ctx.db.putawayLine.count({ where });

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('putaway@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.putawayLine.findUnique({ where: { id: input.id }, include: includePutawayLine });
        if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'putaway.notFound') });
        }
        return row;
    }),

    complete: protectedProcedure.use(hasPermission('putaway@complete')).use(transactional)
        .input(z.object({
            id: z.string(),
            storageLocationId: z.string().min(1, 'Storage location is required'),
        }))
        .mutation(async ({ ctx, input }) => {
            const line = await ctx.db.putawayLine.findUnique({
                where: { id: input.id },
                include: { pallet: { select: { id: true, status: true } } },
            });
            if (!line) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'putaway.notFound') });
            }
            if (line.status === 'COMPLETED') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'putaway.alreadyCompleted') });
            }

            // Verify the storage location exists
            const location = await ctx.db.storageLocation.findUnique({ where: { id: input.storageLocationId } });
            if (!location) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'putaway.locationNotFound') });
            }

            // Assign pallet to location
            await ctx.db.pallet.update({
                where: { id: line.palletId },
                data: { storageLocationId: input.storageLocationId },
            });

            // Complete the putaway line
            const completed = await ctx.db.putawayLine.update({
                where: { id: input.id },
                data: {
                    status: 'COMPLETED',
                    storageLocationId: input.storageLocationId,
                    completedAt: new Date(),
                    completedById: ctx.user!.userId,
                },
                include: includePutawayLine,
            });

            // Sync parent document putawayStatus
            await syncPutawayStatus(ctx.db, line.transactionType, line.documentId);

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'putaway_line',
                resourceId: completed.id,
                message: `Menyelesaikan putaway ${completed.id} ke lokasi ${location.id}`,
                detail: {
                    before: { status: line.status, storageLocationId: line.storageLocationId ?? null },
                    after: { status: 'COMPLETED', storageLocationId: input.storageLocationId },
                },
            });

            return completed;
        }),
});
