import { z } from 'zod';

export const monthlyStockMovementInputSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
});

export type MonthlyStockMovementInput = z.infer<typeof monthlyStockMovementInputSchema>;

export const skuAnnualSummaryInputSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  warehouseId: z.string().optional(),
});

export type SkuAnnualSummaryInput = z.infer<typeof skuAnnualSummaryInputSchema>;

export const skuMonthlyDetailInputSchema = z.object({
  skuId: z.string(),
  year: z.number().int().min(2020).max(2100),
  warehouseId: z.string().optional(),
});

export type SkuMonthlyDetailInput = z.infer<typeof skuMonthlyDetailInputSchema>;

export const skuStockListInputSchema = z.object({
  warehouseId: z.string().optional(),
  search: z.string().optional(),
});

export const inventoryBalanceMonthlyInputSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  warehouseId: z.string().optional(),
});

export type InventoryBalanceMonthlyInput = z.infer<typeof inventoryBalanceMonthlyInputSchema>;
