import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import {
  buildCreateLogDetail,
  buildDeleteLogDetail,
  buildUpdateLogDetail,
} from "../lib/log-detail.js";
import {
  buildPaginationMeta,
  buildPaginationParams,
  buildTextSearchWhere,
} from "../lib/list-query.js";
import { getMessage } from "../lib/locale.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import {
  buildCreateSkuData,
  buildUpdateSkuData,
  getSkuOrThrow,
} from "../lib/sku-mutation-service.js";
import {
  hasPermission,
  protectedProcedure,
  router,
  transactional,
} from "../trpc.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
} from "@repo/schemas/product";
import { createListInputSchema } from "../lib/list-query.js";

/**
 * Router for finished-good product SKUs (type = FINISHED_GOOD).
 *
 * Products are managed independently from raw/packaging materials. Each product record
 * represents one SKU variant — e.g. "Cooking Oil 1L" and "Cooking Oil 2L" are separate products.
 * Packaging dimensions are stored on the SKU for 3D warehouse visualisation.
 *
 * Permissions: `product@read`, `product@create`, `product@update`, `product@delete`
 */
export const productRouter = router({
  /**
   * Paginated list of finished-good products.
   * Supports free-text search across name, id, code, and description.
   *
   * @permission product@read
   */
  list: protectedProcedure
    .use(hasPermission("product@read"))
    .input(createListInputSchema())
    .query(async ({ ctx, input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const where = buildTextSearchWhere(input?.search, [
        "name",
        "id",
        "code",
        "description",
      ] as const);

      const [data, total] = await Promise.all([
        ctx.db.sku.findMany({
          where: { ...where, type: "FINISHED_GOOD" },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.sku.count({ where: { ...where, type: "FINISHED_GOOD" } }),
      ]);

      return { data, meta: buildPaginationMeta({ page, limit, total }) };
    }),

  /**
   * Single finished-good product detail.
   * Includes count of AVAILABLE pallets for quick stock visibility.
   *
   * @permission product@read
   */
  detail: protectedProcedure
    .use(hasPermission("product@read"))
    .input(productIdSchema)
    .query(async ({ ctx, input }) => {
      const sku = await ctx.db.sku.findUnique({
        where: { id: input.id, type: "FINISHED_GOOD" },
        include: {
          pallets: {
            where: { status: { in: ["AVAILABLE"] } },
            select: { id: true },
          },
        },
      });

      if (!sku)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: getMessage(ctx.locale, "product.notFound"),
        });
      return sku;
    }),

  /**
   * Create a new finished-good product.
   * Accepts an optional custom `id`; otherwise Prisma generates a ULID.
   * Code must be unique — conflicts return a CONFLICT error.
   *
   * @permission product@create
   */
  create: protectedProcedure
    .use(hasPermission("product@create"))
    .use(transactional)
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.code) {
        const existing = await ctx.db.sku.findUnique({
          where: { code: input.code },
        });
        if (existing)
          throw new TRPCError({
            code: "CONFLICT",
            message: getMessage(ctx.locale, "product.codeTaken"),
          });
      }

      const data = await buildCreateSkuData({
        input,
        type: "FINISHED_GOOD",
        req: ctx.req,
        locale: ctx.locale,
      });
      const created = await ctx.db.sku.create({ data });

      await logActivity(ctx.db, {
        action: "CREATE",
        userId: ctx.user!.userId,
        resource: "product",
        resourceId: created.id,
        message: `Created product ${created.name}`,
        detail: buildCreateLogDetail(created),
      });

      return created;
    }),

  /**
   * Update a finished-good product's fields.
   * `currentId` identifies the record; code must still be unique among all SKUs.
   *
   * @permission product@update
   */
  update: protectedProcedure
    .use(hasPermission("product@update"))
    .use(transactional)
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getSkuOrThrow({
        db: ctx.db,
        id: input.currentId,
        locale: ctx.locale,
      });

      if (input.code !== existing.code) {
        const taken = await ctx.db.sku.findUnique({
          where: { code: input.code },
        });
        if (taken)
          throw new TRPCError({
            code: "CONFLICT",
            message: getMessage(ctx.locale, "product.codeTaken"),
          });
      }

      const data = await buildUpdateSkuData({
        input,
        existingPhoto: existing.photo,
        req: ctx.req,
        locale: ctx.locale,
      });

      const updated = await ctx.db.sku.update({
        where: { id: input.currentId },
        data,
      });

      await logActivity(ctx.db, {
        action: "UPDATE",
        userId: ctx.user!.userId,
        resource: "product",
        resourceId: updated.id,
        message: `Updated product ${updated.name}`,
        detail: buildUpdateLogDetail(existing, updated),
      });

      return updated;
    }),

  /**
   * Delete a finished-good product.
   * Blocked if the SKU has associated pallets (stock still on-hand).
   * Removes the photo from the upload store if present.
   *
   * @permission product@delete
   */
  delete: protectedProcedure
    .use(hasPermission("product@delete"))
    .use(transactional)
    .input(productIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getSkuOrThrow({
        db: ctx.db,
        id: input.id,
        locale: ctx.locale,
      });

      const palletCount = await ctx.db.pallet.count({
        where: { skuId: input.id },
      });
      if (palletCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: getMessage(ctx.locale, "product.deleteHasPallets"),
        });
      }

      await ctx.db.sku.delete({ where: { id: input.id } });

      await logActivity(ctx.db, {
        action: "DELETE",
        userId: ctx.user!.userId,
        resource: "product",
        resourceId: existing.id,
        message: `Deleted product ${existing.name}`,
        detail: buildDeleteLogDetail(existing),
      });

      await removePhotoValue(existing.photo ?? null);

      return { success: true };
    }),
});
