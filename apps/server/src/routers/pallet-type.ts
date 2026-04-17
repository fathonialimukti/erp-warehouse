import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import { getMessage } from "../lib/locale.js";
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from "../lib/list-query.js";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

const getPalletTypeOrThrow = async (id: string, locale: 'en' | 'id') => {
    const palletType = await prisma.palletType.findUnique({
        where: { id },
        include: { sku: true },
    });

    if (!palletType) {
        throw new TRPCError({ code: "NOT_FOUND", message: getMessage(locale, 'palletType.notFound') });
    }

    return palletType;
};

export const palletTypeRouter = router({
    list: protectedProcedure
        .input(createListInputSchema({ skuId: z.string().optional() }))
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = {
                ...(input?.skuId ? { skuId: input.skuId } : {}),
                ...buildTextSearchWhere(search, ["name", "id", "description"] as const),
            };

            const [data, total] = await Promise.all([
                prisma.palletType.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: { sku: true },
                }),
                prisma.palletType.count({ where }),
            ]);

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return getPalletTypeOrThrow(input.id, ctx.locale);
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                skuId: z.string().min(1, "SKU is required"),
                packageName: z.string().min(1).default("carton"),
                packagesPerPallet: z.number().int().min(1, "Packages per pallet is required"),
                quantityPerPackage: z.number().min(0),
                packageUnit: z.string().min(1).default("kg"),
                length: z.number().int().optional(),
                width: z.number().int().optional(),
                height: z.number().int().optional(),
                maxWeight: z.number().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const palletType = await prisma.palletType.create({
                data: {
                    id: input.id,
                    name: input.name,
                    description: input.description ?? null,
                    skuId: input.skuId,
                    packageName: input.packageName,
                    packagesPerPallet: input.packagesPerPallet,
                    quantityPerPackage: input.quantityPerPackage,
                    packageUnit: input.packageUnit,
                    length: input.length ?? null,
                    width: input.width ?? null,
                    height: input.height ?? null,
                    maxWeight: input.maxWeight ?? null,
                },
                include: { sku: true },
            });

            await logActivity(prisma, {
                action: "CREATE",
                userId: ctx.user.userId,
                resource: "pallet_type",
                resourceId: palletType.id,
                message: `Created pallet type ${palletType.name}`,
                detail: {
                    data: palletType,
                },
            });

            return palletType;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                newId: z.string().min(1, "New ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                skuId: z.string().min(1, "SKU is required"),
                packageName: z.string().min(1),
                packagesPerPallet: z.number().int().min(1),
                quantityPerPackage: z.number().min(0),
                packageUnit: z.string().min(1),
                length: z.number().int().optional(),
                width: z.number().int().optional(),
                height: z.number().int().optional(),
                maxWeight: z.number().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingPalletType = await getPalletTypeOrThrow(input.id, ctx.locale);

            const palletType = await prisma.palletType.update({
                where: { id: input.id },
                data: {
                    id: input.newId,
                    name: input.name,
                    description: input.description ?? null,
                    skuId: input.skuId,
                    packageName: input.packageName,
                    packagesPerPallet: input.packagesPerPallet,
                    quantityPerPackage: input.quantityPerPackage,
                    packageUnit: input.packageUnit,
                    length: input.length ?? null,
                    width: input.width ?? null,
                    height: input.height ?? null,
                    maxWeight: input.maxWeight ?? null,
                },
                include: { sku: true },
            });

            await logActivity(prisma, {
                action: "UPDATE",
                userId: ctx.user.userId,
                resource: "pallet_type",
                resourceId: palletType.id,
                message: `Updated pallet type ${palletType.name}`,
                detail: {
                    before: existingPalletType,
                    after: palletType,
                },
            });

            return palletType;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const existingPalletType = await getPalletTypeOrThrow(input.id, ctx.locale);

            await prisma.palletType.delete({
                where: { id: input.id },
            });

            await logActivity(prisma, {
                action: "DELETE",
                userId: ctx.user.userId,
                resource: "pallet_type",
                resourceId: existingPalletType.id,
                message: `Deleted pallet type ${existingPalletType.name}`,
                detail: {
                    latest: existingPalletType,
                },
            });

            return { success: true };
        }),
});
