import { prisma } from "../lib/prisma.js";
import { publicProcedure, router } from "../trpc.js";

/**
 * Public landing page router — no auth required.
 * Returns WH01 warehouse layout data for the hero 3D scene.
 */
export const landingRouter = router({
  getScene: publicProcedure.query(async () => {
    const warehouse = await prisma.warehouse.findFirst({
      where: { objectId: "WH01" },
      select: { id: true, objectId: true },
    });

    if (!warehouse) {
      return { warehouseObjectId: null, locations: [] };
    }

    const locations = await prisma.storageLocation.findMany({
      where: { warehouseId: warehouse.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        pallet: {
          select: {
            id: true,
            sourceType: true,
            sourceItemId: true,
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

    return { warehouseObjectId: warehouse.objectId, locations };
  }),
});