import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from "../lib/log-detail.js";
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from "../lib/list-query.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import { prisma } from "../lib/prisma.js";
import { buildCreateSkuData, buildUpdateSkuData, getSkuOrThrow } from "../lib/sku-mutation-service.js";
import { palletTypeRouter } from "./pallet-type.js";
import { hasPermission, protectedProcedure, router } from "../trpc.js";
import { createSkuSchema, updateSkuSchema, skuIdSchema } from '@repo/schemas/sku';

export const skuRouter = router({
    list: protectedProcedure.use(hasPermission('sku@read'))
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ["name", "id", "description"] as const);

            const data = await prisma.sku.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            });
            const total = await prisma.sku.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    listWithPalletTypes: protectedProcedure.use(hasPermission('sku@read'))
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ["name", "id", "description"] as const);

            const data = await prisma.sku.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    palletTypes: {
                        select: {
                            id: true,
                            name: true,
                            skuId: true,
                        },
                    },
                },
            });
            const total = await prisma.sku.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    palletType: palletTypeRouter,

    detail: protectedProcedure.use(hasPermission('sku@read'))
        .input(skuIdSchema)
        .query(async ({ input, ctx }) => {
            return getSkuOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
        }),

    create: protectedProcedure.use(hasPermission('sku@create'))
        .input(createSkuSchema)
        .mutation(async ({ input, ctx }) => {
            const skuData = await buildCreateSkuData({ input, req: ctx.req, locale: ctx.locale });

            const createdSku = await prisma.sku.create({
                data: skuData,
            });

            await logActivity(prisma, {
                action: "CREATE",
                userId: ctx.user.userId,
                resource: "sku",
                resourceId: createdSku.id,
                message: `Created SKU ${createdSku.name}`,
                detail: buildCreateLogDetail(createdSku),
            });

            return createdSku;
        }),

    update: protectedProcedure.use(hasPermission('sku@update'))
        .input(updateSkuSchema)
        .mutation(async ({ input, ctx }) => {
            const existingSku = await getSkuOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
            const skuData = await buildUpdateSkuData({
                input: {
                    newId: input.newId,
                    name: input.name,
                    description: input.description,
                    photo: input.photo,
                    baseUnit: input.baseUnit,
                },
                existingPhoto: existingSku.photo,
                req: ctx.req,
                locale: ctx.locale,
            });

            return prisma.sku.update({
                where: { id: input.id },
                data: skuData,
            }).then(async (updatedSku) => {
                await logActivity(prisma, {
                    action: "UPDATE",
                    userId: ctx.user.userId,
                    resource: "sku",
                    resourceId: updatedSku.id,
                    message: `Updated SKU ${updatedSku.name}`,
                    detail: buildUpdateLogDetail(existingSku, updatedSku),
                });

                return updatedSku;
            });
        }),

    delete: protectedProcedure.use(hasPermission('sku@delete'))
        .input(skuIdSchema)
        .mutation(async ({ ctx, input }) => {
            const existingSku = await getSkuOrThrow({ db: prisma, id: input.id, locale: ctx.locale });

            await prisma.sku.delete({
                where: { id: input.id },
            });

            await logActivity(prisma, {
                action: "DELETE",
                userId: ctx.user.userId,
                resource: "sku",
                resourceId: existingSku.id,
                message: `Deleted SKU ${existingSku.name}`,
                detail: buildDeleteLogDetail(existingSku),
            });

            await removePhotoValue(existingSku.photo ?? null);

            return { success: true };
        }),
});
