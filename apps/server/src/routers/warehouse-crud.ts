import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from "../lib/list-query.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import { prisma } from "../lib/prisma.js";
import { buildCreateWarehouseData, buildUpdateWarehouseData, getWarehouseOrThrow } from "../lib/warehouse-mutation-service.js";
import { protectedProcedure, router } from "../trpc.js";

export const warehouseRouter = router({
    list: protectedProcedure
        .input(createListInputSchema())
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = buildTextSearchWhere(search, ["id", "name", "address"] as const);

            const [data, total] = await Promise.all([
                prisma.warehouse.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.warehouse.count({ where }),
            ]);

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            return getWarehouseOrThrow({ db: prisma, id: input.id, locale: ctx.locale });
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                address: z.string().min(1, "Address is required"),
                totalCapacity: z.number().int().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const warehouseData = await buildCreateWarehouseData({ input, req: ctx.req, locale: ctx.locale });

            const createdWarehouse = await prisma.warehouse.create({
                data: warehouseData,
            });

            await logActivity(prisma, {
                action: "CREATE",
                userId: ctx.user.userId,
                resource: "warehouse",
                resourceId: createdWarehouse.id,
                message: `Created warehouse ${createdWarehouse.name}`,
                detail: {
                    data: createdWarehouse,
                },
            });

            return createdWarehouse;
        }),

    update: protectedProcedure
        .input(
            z.object({
                currentId: z.string(),
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                address: z.string().min(1, "Address is required"),
                totalCapacity: z.number().int().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingWarehouse = await getWarehouseOrThrow({ db: prisma, id: input.currentId, locale: ctx.locale });
            const warehouseData = await buildUpdateWarehouseData({
                input: {
                    id: input.id,
                    name: input.name,
                    address: input.address,
                    totalCapacity: input.totalCapacity,
                    photo: input.photo,
                },
                existingPhoto: existingWarehouse.photo,
                req: ctx.req,
                locale: ctx.locale,
            });

            const updatedWarehouse = await prisma.warehouse.update({
                where: { id: input.currentId },
                data: warehouseData,
            });

            await logActivity(prisma, {
                action: "UPDATE",
                userId: ctx.user.userId,
                resource: "warehouse",
                resourceId: updatedWarehouse.id,
                message: `Updated warehouse ${updatedWarehouse.name}`,
                detail: {
                    before: existingWarehouse,
                    after: updatedWarehouse,
                },
            });

            return updatedWarehouse;
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const existingWarehouse = await getWarehouseOrThrow({ db: prisma, id: input.id, locale: ctx.locale });

            await prisma.warehouse.delete({
                where: { id: input.id },
            });

            await logActivity(prisma, {
                action: "DELETE",
                userId: ctx.user.userId,
                resource: "warehouse",
                resourceId: existingWarehouse.id,
                message: `Deleted warehouse ${existingWarehouse.name}`,
                detail: {
                    latest: existingWarehouse,
                },
            });

            await removePhotoValue(existingWarehouse.photo ?? null);

            return { success: true };
        }),
});
