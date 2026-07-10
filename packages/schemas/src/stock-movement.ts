import { z } from 'zod';
import { createListInputSchema } from './common';

export const stockMovementListInputSchema = createListInputSchema({
  skuId: z.string().optional(),
  warehouseId: z.string().optional(),
  transactionType: z
    .enum([
      'RECEIVING',
      'WIP_COMPLETION',
      'RMA_RECEIPT',
      'FOUND',
      'WIP_ISSUE',
      'SHIPMENT',
      'RETURN_TO_SUPPLIER',
      'DISPOSAL',
      'LOSS',
      'SUBINVENTORY_TRANSFER',
    ])
    .optional(),
  direction: z.enum(['IN', 'OUT', 'NONE']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const stockMovementIdSchema = z.object({
  id: z.string().min(1),
});

export type StockMovementListInput = z.infer<
  ReturnType<typeof stockMovementListInputSchema.unwrap>
>;
