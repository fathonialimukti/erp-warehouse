import { z } from "zod";

// =============================================
// CYCLE COUNT (STOCK OPNAME)
// =============================================

export const stockCountStatusValues = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const stockCountStatusSchema = z.enum(stockCountStatusValues);

export const createStockCountSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  isBlindCount: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  /** Optional SKU filter — only these SKUs are counted. */
  skuIds: z.array(z.string()).optional(),
});

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

export const stockCountIdSchema = z.object({ id: z.string().min(1) });

export const saveStockCountLinesSchema = z.object({
  id: z.string().min(1),
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        countedQty: z.number().min(0),
      }),
    )
    .min(1),
});

export type SaveStockCountLinesInput = z.infer<
  typeof saveStockCountLinesSchema
>;

export const approveStockCountSchema = z.object({
  id: z.string().min(1),
  message: z.string().max(2000).optional(),
});

export const transitionStockCountSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["IN_PROGRESS", "CANCELLED"]),
});
