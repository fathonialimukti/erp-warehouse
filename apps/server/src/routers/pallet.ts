import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { buildPaginationMeta, buildPaginationParams, createListInputSchema } from "../lib/list-query.js";
import { prisma } from "../lib/prisma.js";
import { getNextPalletNumber } from "../lib/pallet-number.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import { palletStatusSchema } from "@repo/schemas/pallet";

const getPalletOrThrow = async (id: string, locale: 'en' | 'id') => {
    const pallet = await prisma.pallet.findUnique({
        where: { id },
        include: {
            sku: true,
            storageLocation: { include: { warehouse: true } },
        },
    });

    if (!pallet) {
        throw new TRPCError({ code: "NOT_FOUND", message: getMessage(locale, 'pallet.notFound') });
    }

    return pallet;
};

export const palletRouter = router({
    list: protectedProcedure
        .input(
            createListInputSchema({
                status: palletStatusSchema.optional(),
                skuId: z.string().optional(),
                storageLocationId: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = {
                ...(input?.status ? { status: input.status } : {}),
                ...(input?.skuId ? { skuId: input.skuId } : {}),
                ...(input?.storageLocationId
                    ? { storageLocationId: input.storageLocationId }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            { id: { contains: search, mode: "insensitive" as const } },
                            { palletNumber: { contains: search, mode: "insensitive" as const } },
                        ],
                    }
                    : {}),
            };

            const data = await prisma.pallet.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    sku: true,
                    storageLocation: { include: { warehouse: true } },
                },
            });
            const total = await prisma.pallet.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return getPalletOrThrow(input.id, ctx.locale);
        }),

    create: transactionalProtectedProcedure
        .input(
            z.object({
                skuId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: palletStatusSchema.default("AVAILABLE"),
                palletNumber: z.string().optional(),
                lotNo: z.string().max(100).optional(),
                expiryDate: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            // palletNumber is server-generated unless explicitly provided (seed/import)
            const palletNumber = input.palletNumber ?? await getNextPalletNumber(ctx.db, new Date());

            const pallet = await ctx.db.pallet.create({
                data: {
                    palletNumber,
                    skuId: input.skuId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    lotNo: input.lotNo?.trim() || null,
                    expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
                },
                include: {
                    sku: true,
                },
            });

            await logActivity(ctx.db, {
                action: "CREATE",
                userId: ctx.user!.userId,
                resource: "pallet",
                resourceId: pallet.id,
                message: `Created pallet ${pallet.palletNumber ?? pallet.id}`,
                detail: {
                    data: pallet,
                },
            });

            return pallet;
        }),

    update: transactionalProtectedProcedure
        .input(
            z.object({
                id: z.string(),
                skuId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: palletStatusSchema,
                palletNumber: z.string().optional(),
                lotNo: z.string().max(100).optional(),
                expiryDate: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingPallet = await getPalletOrThrow(input.id, ctx.locale);

            const pallet = await ctx.db.pallet.update({
                where: { id: input.id },
                data: {
                    palletNumber: input.palletNumber ?? undefined,
                    skuId: input.skuId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    lotNo: input.lotNo !== undefined ? (input.lotNo.trim() || null) : undefined,
                    expiryDate: input.expiryDate !== undefined ? (input.expiryDate ? new Date(input.expiryDate) : null) : undefined,
                },
                include: {
                    sku: true,
                },
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "pallet",
                resourceId: pallet.id,
                message: `Updated pallet ${pallet.palletNumber ?? pallet.id}`,
                detail: {
                    before: existingPallet,
                    after: pallet,
                },
            });

            return pallet;
        }),

    delete: transactionalProtectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const existingPallet = await getPalletOrThrow(input.id, ctx.locale);

            await ctx.db.pallet.delete({
                where: { id: input.id },
            });

            await logActivity(ctx.db, {
                action: "DELETE",
                userId: ctx.user!.userId,
                resource: "pallet",
                resourceId: existingPallet.id,
                message: `Deleted pallet ${existingPallet.palletNumber ?? existingPallet.id}`,
                detail: {
                    latest: existingPallet,
                },
            });

            return { success: true };
        }),
});

