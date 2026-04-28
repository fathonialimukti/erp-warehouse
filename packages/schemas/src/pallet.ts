import { z } from 'zod';

// Pallet status values
export const palletStatusValues = ['AVAILABLE', 'NOT_AVAILABLE'] as const;
export const palletStatusSchema = z.enum(palletStatusValues);

// Pallet schemas
export const createPalletSchema = z.object({
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  storageLocationId: z.string().optional(),
  status: palletStatusSchema.default('AVAILABLE'),
});

export const updatePalletSchema = z.object({
  id: z.string(),
  palletTypeId: z.string().min(1, 'Pallet type is required'),
  storageLocationId: z.string().optional(),
  status: palletStatusSchema,
});

export const palletIdSchema = z.object({
  id: z.string(),
});

// Pallet type schemas
export const createPalletTypeSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  skuId: z.string().min(1, 'SKU is required'),
  packageName: z.string().min(1).default('carton'),
  packagesPerPallet: z.number().int().min(1, 'Packages per pallet is required'),
  quantityPerPackage: z.number().min(0),
  packageUnit: z.string().min(1).default('kg'),
  length: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  maxWeight: z.number().optional(),
});

export const updatePalletTypeSchema = z.object({
  id: z.string(),
  newId: z.string().min(1, 'New ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  skuId: z.string().min(1, 'SKU is required'),
  packageName: z.string().min(1),
  packagesPerPallet: z.number().int().min(1),
  quantityPerPackage: z.number().min(0),
  packageUnit: z.string().min(1),
  length: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  maxWeight: z.number().optional(),
});

export const palletTypeIdSchema = z.object({
  id: z.string(),
});

export type PalletStatus = z.infer<typeof palletStatusSchema>;
export type CreatePalletInput = z.infer<typeof createPalletSchema>;
export type UpdatePalletInput = z.infer<typeof updatePalletSchema>;
export type PalletIdInput = z.infer<typeof palletIdSchema>;
export type CreatePalletTypeInput = z.infer<typeof createPalletTypeSchema>;
export type UpdatePalletTypeInput = z.infer<typeof updatePalletTypeSchema>;
export type PalletTypeIdInput = z.infer<typeof palletTypeIdSchema>;