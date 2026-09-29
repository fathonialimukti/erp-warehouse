import { z } from "zod";
import {
  buildPaginationMeta,
  buildPaginationParams,
  buildTextSearchWhere,
  createListInputSchema,
} from "../lib/list-query.js";
import { prisma } from "../lib/prisma.js";
import { skuIdSchema } from "@repo/schemas/sku";
import { getMessage } from "../lib/locale.js";
import { TRPCError } from "@trpc/server";
import { hasPermission, protectedProcedure, router } from "../trpc.js";

/**
 * Read-only router for the SKU overview page.
 *
 * This router surfaces all three SKU types (RAW_MATERIAL, PACKAGING_MATERIAL, FINISHED_GOOD)
 * in a unified read-only view with optional type filtering.
 *
 * Mutations are intentionally absent:
 * - Raw/packaging material SKUs are managed via `supplier.addMaterial / updateMaterial / removeMaterial`
 * - Finished-good SKUs are managed via the `product` router
 *
 * @permission sku@read
 */
export const skuRouter = router({
  /**
   * Paginated list of all SKUs with optional type filter.
   * Searches across name, id, code, and description.
   *
   * @param input.type  Optional SkuType filter: FINISHED_GOOD | RAW_MATERIAL | PACKAGING_MATERIAL
   * @permission sku@read
   */
  list: protectedProcedure
    .use(hasPermission("sku@read"))
    .input(
      createListInputSchema({
        type: z
          .enum(["FINISHED_GOOD", "RAW_MATERIAL", "PACKAGING_MATERIAL"])
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const textWhere = buildTextSearchWhere(input?.search, [
        "name",
        "id",
        "code",
        "description",
      ] as const);

      const where = {
        ...textWhere,
        ...(input?.type ? { type: input.type } : {}),
      };

      const [data, total] = await Promise.all([
        prisma.sku.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            suppliers: {
              select: {
                supplier: { select: { id: true, name: true, code: true } },
              },
            },
          },
        }),
        prisma.sku.count({ where }),
      ]);

      return { data, meta: buildPaginationMeta({ page, limit, total }) };
    }),

  /**
   * Single SKU detail — read-only, includes AVAILABLE pallet count and linked suppliers.
   *
   * @permission sku@read
   */
  detail: protectedProcedure
    .use(hasPermission("sku@read"))
    .input(skuIdSchema)
    .query(async ({ input, ctx }) => {
      const sku = await prisma.sku.findUnique({
        where: { id: input.id },
        include: {
          pallets: {
            where: { status: { in: ["AVAILABLE"] } },
            select: { id: true },
          },
          suppliers: {
            include: {
              supplier: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!sku)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: getMessage(ctx.locale, "sku.notFound"),
        });
      return sku;
    }),
});
