import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hasPermission, protectedProcedure, router } from "../trpc.js";
import { classifyAging } from "./inventory-aging.js";

/** Aging category values produced by `classifyAging`. */
type AgingCategory = "active" | "slow_moving" | "dead_stock" | "no_data";

/** Pallet as returned inside a storage location, enriched with aging data. */
type ScenePallet = {
    id: string;
    sourceType: string | null;
    sourceItemId: string | null;
    skuId: string;
    sku: {
        id: string;
        name: string;
        objectId: string | null;
    } | null;
    daysSinceMovement: number | null;
    agingCategory: AgingCategory;
};

/** Storage location as returned by `getScene`. */
type SceneLocation = {
    id: string;
    pallet: ScenePallet | null;
};

/** `getScene` procedure output. */
type WarehouseSceneResult = {
    warehouseObjectId: string | null;
    locations: SceneLocation[];
};

export const warehouseLayoutRouter = router({
    getScene: protectedProcedure
        .use(hasPermission("warehouse@read"))
        .input(z.object({ warehouseId: z.string().min(1) }))
        .query(async ({ input }): Promise<WarehouseSceneResult> => {
            const warehouse = await prisma.warehouse.findUnique({
                where: { id: input.warehouseId },
                select: { objectId: true },
            });

            const locations = await prisma.storageLocation.findMany({
                where: { warehouseId: input.warehouseId },
                orderBy: { id: "asc" },
                select: {
                    id: true,
                    pallet: {
                        select: {
                            id: true,
                            sourceType: true,
                            sourceItemId: true,
                            skuId: true,
                            sku: {
                                select: {
                                    id: true,
                                    name: true,
                                    objectId: true,
                                },
                            },
                        },
                    },
                },
            });

            const palletIds = locations
                .map((location) => location.pallet?.id)
                .filter((id): id is string => Boolean(id));

            const latestMovements = palletIds.length
                ? await prisma.stockMovement.findMany({
                      where: {
                          skuId: {
                              in: locations
                                  .map((location) => location.pallet?.skuId)
                                  .filter((skuId): skuId is string => Boolean(skuId)),
                          },
                          warehouseId: input.warehouseId,
                      },
                      orderBy: { transactionDate: "desc" },
                      select: {
                          skuId: true,
                          transactionDate: true,
                      },
                  })
                : [];

            const latestBySku = new Map<string, Date>();
            for (const movement of latestMovements) {
                if (!latestBySku.has(movement.skuId)) {
                    latestBySku.set(movement.skuId, movement.transactionDate);
                }
            }

            const now = new Date();
            const enrichedLocations: SceneLocation[] = locations.map((location) => {
                if (!location.pallet) {
                    return { id: location.id, pallet: null };
                }

                const lastMovement = latestBySku.get(location.pallet.skuId) ?? null;
                const daysSinceMovement = lastMovement
                    ? Math.floor((now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                return {
                    id: location.id,
                    pallet: {
                        ...location.pallet,
                        daysSinceMovement,
                        agingCategory: classifyAging(daysSinceMovement),
                    },
                };
            });

            return { warehouseObjectId: warehouse?.objectId ?? null, locations: enrichedLocations };
        }),
});
