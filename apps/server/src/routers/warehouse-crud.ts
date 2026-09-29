import { logActivity } from "../lib/activity-log.js";
import {
  buildCreateLogDetail,
  buildUpdateLogDetail,
  buildDeleteLogDetail,
} from "../lib/log-detail.js";
import {
  buildPaginationMeta,
  buildPaginationParams,
  buildTextSearchWhere,
  createListInputSchema,
} from "../lib/list-query.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import { prisma } from "../lib/prisma.js";
import {
  buildCreateWarehouseData,
  buildUpdateWarehouseData,
  getWarehouseOrThrow,
} from "../lib/warehouse-mutation-service.js";
import {
  hasPermission,
  protectedProcedure,
  router,
  transactional,
} from "../trpc.js";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseIdSchema,
} from "@repo/schemas/warehouse";

export const warehouseRouter = router({
  list: protectedProcedure
    .use(hasPermission("warehouse@read"))
    .input(createListInputSchema())
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const search = input?.search;

      const where = buildTextSearchWhere(search, [
        "id",
        "code",
        "objectId",
        "name",
        "address",
      ] as const);

      const data = await prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      const total = await prisma.warehouse.count({ where });

      return {
        data,
        meta: buildPaginationMeta({ page, limit, total }),
      };
    }),

  detail: protectedProcedure
    .use(hasPermission("warehouse@read"))
    .input(warehouseIdSchema)
    .query(async ({ ctx, input }) => {
      return getWarehouseOrThrow({
        db: prisma,
        id: input.id,
        locale: ctx.locale,
      });
    }),

  create: protectedProcedure
    .use(hasPermission("warehouse@create"))
    .input(createWarehouseSchema)
    .mutation(async ({ input, ctx }) => {
      const warehouseData = await buildCreateWarehouseData({
        input,
        req: ctx.req,
        locale: ctx.locale,
      });

      const createdWarehouse = await prisma.warehouse.create({
        data: warehouseData,
      });

      await logActivity(prisma, {
        action: "CREATE",
        userId: ctx.user.userId,
        resource: "warehouse",
        resourceId: createdWarehouse.id,
        message: `Created warehouse ${createdWarehouse.name}`,
        detail: buildCreateLogDetail(createdWarehouse),
      });

      return createdWarehouse;
    }),

  update: protectedProcedure
    .use(hasPermission("warehouse@update"))
    .use(transactional)
    .input(updateWarehouseSchema)
    .mutation(async ({ input, ctx }) => {
      const existingWarehouse = await getWarehouseOrThrow({
        db: ctx.db,
        id: input.currentId,
        locale: ctx.locale,
      });
      const warehouseData = await buildUpdateWarehouseData({
        input: {
          code: input.code,
          objectId: input.objectId,
          name: input.name,
          address: input.address,
          totalCapacity: input.totalCapacity,
          photo: input.photo,
        },
        existingPhoto: existingWarehouse.photo,
        req: ctx.req,
        locale: ctx.locale,
      });

      const updatedWarehouse = await ctx.db.warehouse.update({
        where: { id: input.currentId },
        data: warehouseData,
      });

      await logActivity(ctx.db, {
        action: "UPDATE",
        userId: ctx.user!.userId,
        resource: "warehouse",
        resourceId: updatedWarehouse.id,
        message: `Updated warehouse ${updatedWarehouse.name}`,
        detail: buildUpdateLogDetail(existingWarehouse, updatedWarehouse),
      });

      return updatedWarehouse;
    }),

  delete: protectedProcedure
    .use(hasPermission("warehouse@delete"))
    .use(transactional)
    .input(warehouseIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existingWarehouse = await getWarehouseOrThrow({
        db: ctx.db,
        id: input.id,
        locale: ctx.locale,
      });

      await ctx.db.warehouse.delete({
        where: { id: input.id },
      });

      await logActivity(ctx.db, {
        action: "DELETE",
        userId: ctx.user!.userId,
        resource: "warehouse",
        resourceId: existingWarehouse.id,
        message: `Deleted warehouse ${existingWarehouse.name}`,
        detail: buildDeleteLogDetail(existingWarehouse),
      });

      await removePhotoValue(existingWarehouse.photo ?? null);

      return { success: true };
    }),
});
