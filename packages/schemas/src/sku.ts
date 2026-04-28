import { z } from 'zod';

// SKU schemas
export const createSkuSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
});

export const updateSkuSchema = z.object({
  id: z.string(),
  newId: z.string().min(1, 'New ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
});

export const skuIdSchema = z.object({
  id: z.string(),
});

export type CreateSkuInput = z.infer<typeof createSkuSchema>;
export type UpdateSkuInput = z.infer<typeof updateSkuSchema>;
export type SkuIdInput = z.infer<typeof skuIdSchema>;