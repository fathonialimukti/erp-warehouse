import { z } from 'zod';
import { createListInputSchema } from './common';

export const supplierListInputSchema = createListInputSchema();

export const supplierIdSchema = z.object({
  id: z.string().min(1),
});

// Form schema — works for both create and update
export const supplierFormSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// Strict schema for tRPC create mutation
export const createSupplierSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// Strict schema for tRPC update mutation
export const updateSupplierSchema = createSupplierSchema
  .partial()
  .extend({ id: z.string().min(1) });

// SupplierSku pivot schema (used when linking SKUs to a supplier)
export const supplierSkuSchema = z.object({
  supplierId: z.string().min(1),
  skuId: z.string().min(1),
  supplierItemCode: z.string().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional(),
  minimumOrderQty: z.coerce.number().nonnegative().optional(),
  isPreferred: z.boolean().default(false),
});

export const upsertSupplierSkuSchema = supplierSkuSchema;

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierSkuInput = z.infer<typeof supplierSkuSchema>;
