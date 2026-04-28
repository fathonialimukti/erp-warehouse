import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hasPermission, protectedProcedure, router } from "../trpc.js";

export const warehouseLayoutRouter = router({
    getScene: protectedProcedure
        .use(hasPermission("warehouse@read"))
        .input(z.object({ warehouseId: z.string().min(1) }))
        .query(async ({ input }) => {
            const locations = await prisma.storageLocation.findMany({
                where: { warehouseId: input.warehouseId },
                orderBy: { id: "asc" },
                select: {
                    id: true,
                    pallet: {
                        select: {
                            id: true,
                            palletType: {
                                select: { id: true },
                            },
                        },
                    },
                },
            });

            return locations.map((loc) => ({
                id: loc.id,
                palletId: loc.pallet?.id ?? null,
                palletTypeId: loc.pallet?.palletType.id ?? null,
            }));
        }),
});
