import { z } from 'zod';

// SKU schemas
export const createSkuSchema = z.object({
  id: z.string().min(1, 'ID is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
}).refine((value) => Boolean(value.id?.trim() || value.code?.trim()), {
  message: 'Code is required',
  path: ['code'],
});

export const updateSkuSchema = z.object({
  currentId: z.string(),
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
});

export const skuIdSchema = z.object({
  id: z.string(),
});

// Form schemas — skuCode/skuName match form state; API uses id/name
export const skuFormSchema = z.object({
  skuCode: z.string().min(1, 'SKU code is required.'),
  skuName: z.string().min(1, 'SKU name is required.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.'),
  baseUnit: z.string(),
});

export type SkuFormValues = z.infer<typeof skuFormSchema>;
export type CreateSkuInput = z.infer<typeof createSkuSchema>;
export type UpdateSkuInput = z.infer<typeof updateSkuSchema>;
export type SkuIdInput = z.infer<typeof skuIdSchema>;