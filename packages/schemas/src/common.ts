import { z } from 'zod';

// Base list and pagination schemas
export const baseListInputSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const basePaginationInputSchema = baseListInputSchema.omit({ search: true });

export function createListInputSchema(): z.ZodOptional<typeof baseListInputSchema>;
export function createListInputSchema<T extends z.ZodRawShape>(
  extraShape: T,
): z.ZodOptional<ReturnType<typeof baseListInputSchema.extend<T>>>;
export function createListInputSchema<T extends z.ZodRawShape>(extraShape?: T) {
  if (!extraShape) {
    return baseListInputSchema.optional();
  }

  return baseListInputSchema.extend(extraShape).optional();
}

export function createPaginationInputSchema(): z.ZodOptional<typeof basePaginationInputSchema>;
export function createPaginationInputSchema<T extends z.ZodRawShape>(
  extraShape: T,
): z.ZodOptional<ReturnType<typeof basePaginationInputSchema.extend<T>>>;
export function createPaginationInputSchema<T extends z.ZodRawShape>(extraShape?: T) {
  if (!extraShape) {
    return basePaginationInputSchema.optional();
  }

  return basePaginationInputSchema.extend(extraShape).optional();
}

export type BaseListInput = z.infer<typeof baseListInputSchema>;
export type BasePaginationInput = z.infer<typeof basePaginationInputSchema>;