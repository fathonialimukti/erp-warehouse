import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { publicProcedure, router } from "../trpc.js";

const contactInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

/**
 * Public landing page router — no auth required.
 * Returns WH01 warehouse layout data for the hero 3D scene
 * and accepts contact form submissions.
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

  submitContact: publicProcedure
    .input(contactInputSchema)
    .mutation(async ({ input }) => {
      // ponytail: store as JSON in a simple log table or just log it.
      // For now, we just acknowledge receipt. A proper DB table can be added later.
      console.log("[Contact Form]", JSON.stringify(input));
      return { success: true };
    }),
});