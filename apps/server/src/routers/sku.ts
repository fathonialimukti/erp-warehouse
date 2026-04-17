import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from "../lib/list-query.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import { prisma } from "../lib/prisma.js";
import { buildCreateSkuData, buildUpdateSkuData, getSkuOrThrow } from "../lib/sku-mutation-service.js";
import { protectedProcedure, router } from "../trpc.js";

export const skuRouter = router({
    list: protectedProcedure
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ["name", "id", "description"] as const);

            const [data, total] = await Promise.all([
                prisma.sku.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.sku.count({ where }),
            ]);

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return getSkuOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                photo: z.string().optional(),
                baseUnit: z.string().optional(),
            })
        )
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
                detail: {
                    data: createdSku,
                },
            });

            return createdSku;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                newId: z.string().min(1, "New ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                photo: z.string().optional(),
                baseUnit: z.string().optional(),
            })
        )
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
                    detail: {
                        before: existingSku,
                        after: updatedSku,
                    },
                });

                return updatedSku;
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
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
                detail: {
                    latest: existingSku,
                },
            });

            await removePhotoValue(existingSku.photo ?? null);

            return { success: true };
        }),
});
