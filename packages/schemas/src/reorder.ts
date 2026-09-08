import { z } from 'zod';

// =============================================
// REORDER POINTS
// =============================================

export const reorderPolicySchema = z.object({
  skuId: z.string().min(1),
  warehouseId: z.string().min(1),
  minQty: z.number().min(0),
  maxQty: z.number().min(0),
  reorderPoint: z.number().min(0),
  preferredSupplierId: z.string().min(1).nullish(),
});

export type ReorderPolicyInput = z.infer<typeof reorderPolicySchema>;

export const reorderPolicyUpdateSchema = reorderPolicySchema.partial().extend({
  id: z.string().min(1),
});

export type ReorderPolicyUpdateInput = z.infer<typeof reorderPolicyUpdateSchema>;

export const reorderListInputSchema = z.object({
  warehouseId: z.string().min(1).optional(),
  status: z.enum(['all', 'below_min', 'below_reorder', 'ok']).default('all'),
});

export type ReorderListInput = z.infer<typeof reorderListInputSchema>;
