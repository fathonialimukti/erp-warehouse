import { z } from 'zod';
import { createListInputSchema } from './common';

export const skuInventoryBalanceListInputSchema = createListInputSchema({
  skuId: z.string().optional(),
  warehouseId: z.string().optional(),
  year: z.coerce.number().int().min(2000).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const skuInventoryBalanceIdSchema = z.object({
  id: z.string().min(1),
});

export type SkuInventoryBalanceListInput = z.infer<
  ReturnType<typeof skuInventoryBalanceListInputSchema.unwrap>
>;
