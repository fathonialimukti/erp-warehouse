import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { buildPaginationMeta, buildPaginationParams, createListInputSchema } from "../lib/list-query.js";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";

const palletStatusValues = [
    "RECEIVED",
    "PLACED",
    "DISPATCHED",
    "LOST",
    "FOUND",
    "DAMAGED",
] as const;

const getPalletOrThrow = async (id: string, locale: 'en' | 'id') => {
    const pallet = await prisma.pallet.findUnique({
        where: { id },
        include: {
            palletType: { include: { sku: true } },
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
                status: z.enum(palletStatusValues).optional(),
                palletTypeId: z.string().optional(),
                storageLocationId: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = {
                ...(input?.status ? { status: input.status } : {}),
                ...(input?.palletTypeId ? { palletTypeId: input.palletTypeId } : {}),
                ...(input?.storageLocationId
                    ? { storageLocationId: input.storageLocationId }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            { id: { contains: search, mode: "insensitive" as const } },
                            { palletType: { id: { contains: search, mode: "insensitive" as const } } },
                            { palletType: { name: { contains: search, mode: "insensitive" as const } } },
                        ],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.pallet.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: {
                        palletType: { include: { sku: true } },
                        storageLocation: { include: { warehouse: true } },
                    },
                }),
                prisma.pallet.count({ where }),
            ]);

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
                palletTypeId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: z.enum(palletStatusValues).default("RECEIVED"),
                receivedAt: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const pallet = await ctx.db.pallet.create({
                data: {
                    palletTypeId: input.palletTypeId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    receivedAt: input.receivedAt ?? null,
                },
                include: {
                    palletType: { include: { sku: true } },
                },
            });

            await logActivity(ctx.db, {
                action: "CREATE",
                userId: ctx.user!.userId,
                resource: "pallet",
                resourceId: pallet.id,
                message: `Created pallet ${pallet.id}`,
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
                palletTypeId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: z.enum(palletStatusValues),
                receivedAt: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingPallet = await getPalletOrThrow(input.id, ctx.locale);

            const pallet = await ctx.db.pallet.update({
                where: { id: input.id },
                data: {
                    palletTypeId: input.palletTypeId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    receivedAt: input.receivedAt ?? null,
                },
                include: {
                    palletType: { include: { sku: true } },
                },
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "pallet",
                resourceId: pallet.id,
                message: `Updated pallet ${pallet.id}`,
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
                message: `Deleted pallet ${existingPallet.id}`,
                detail: {
                    latest: existingPallet,
                },
            });

            return { success: true };
        }),
});

