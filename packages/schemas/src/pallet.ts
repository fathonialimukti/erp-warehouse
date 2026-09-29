import { z } from "zod";

// Pallet status values
export const palletStatusValues = ["AVAILABLE", "NOT_AVAILABLE"] as const;
export const palletStatusSchema = z.enum(palletStatusValues);

// Pallet schemas
export const createPalletSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  storageLocationId: z.string().optional(),
  status: palletStatusSchema.default("AVAILABLE"),
  // palletNumber is server-generated; accepted here only for seed/import flows
  palletNumber: z.string().optional(),
  // Lot / expiry tracking (FEFO picking)
  lotNo: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
});

export const updatePalletSchema = z.object({
  id: z.string(),
  skuId: z.string().min(1, "SKU is required"),
  storageLocationId: z.string().optional(),
  status: palletStatusSchema,
  palletNumber: z.string().optional(),
  lotNo: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
});

export const palletIdSchema = z.object({
  id: z.string(),
});

export type PalletStatus = z.infer<typeof palletStatusSchema>;
export type CreatePalletInput = z.infer<typeof createPalletSchema>;
export type UpdatePalletInput = z.infer<typeof updatePalletSchema>;
export type PalletIdInput = z.infer<typeof palletIdSchema>;
