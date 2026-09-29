import { z } from "zod";
import { createListInputSchema } from "./common";

export const supplierListInputSchema = createListInputSchema();

export const supplierIdSchema = z.object({
  id: z.string().min(1),
});

// Form schema — works for both create and update
export const supplierFormSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// Strict schema for tRPC create mutation
export const createSupplierSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Supplier name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
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
export type SupplierSkuInput = z.infer<typeof supplierSkuSchema>;

// =============================================
// MATERIAL SKU — managed from the Supplier detail page
// =============================================

const materialSkuFieldsShape = {
  name: z.string().min(1, "Name is required"),
  type: z.enum(["RAW_MATERIAL", "PACKAGING_MATERIAL"]),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
  packageName: z.string().min(1, "Package name is required"),
  packagesPerPallet: z.number().int().min(1, "Packages per pallet is required"),
  quantityPerPackage: z.number().min(0, "Quantity per package is required"),
  packageUnit: z.string().min(1, "Package unit is required"),
  length: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  maxWeight: z.number().optional(),
  // SupplierSku pivot pricing fields — stored on the join record
  supplierItemCode: z.string().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional(),
  minimumOrderQty: z.coerce.number().nonnegative().optional(),
  isPreferred: z.boolean().default(false),
};

/**
 * Input schema for creating a material SKU (RAW_MATERIAL | PACKAGING_MATERIAL) from the
 * Supplier detail page. Creates both the SKU record and the SupplierSku pivot in one shot.
 */
export const createMaterialSchema = z
  .object({
    supplierId: z.string().min(1),
    id: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    ...materialSkuFieldsShape,
  })
  .refine((v) => Boolean(v.id?.trim() || v.code?.trim()), {
    message: "Code is required",
    path: ["code"],
  });

/**
 * Input schema for updating a material SKU and/or its SupplierSku pivot data.
 */
export const updateMaterialSchema = z.object({
  supplierId: z.string().min(1),
  skuId: z.string().min(1),
  code: z.string().min(1, "Code is required"),
  ...materialSkuFieldsShape,
});

/** Input schema for removing a material SKU from a supplier (deletes SKU if no stock). */
export const removeMaterialSchema = z.object({
  supplierId: z.string().min(1),
  skuId: z.string().min(1),
});

/** Client-side form schema for the material create/edit form on the Supplier detail page. */
export const materialFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  ...materialSkuFieldsShape,
  // Override: form needs concrete types, not coerce (unknown input) or .default() (undefined input)
  isPreferred: z.boolean(),
  unitPrice: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  minimumOrderQty: z.number().nonnegative().optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type RemoveMaterialInput = z.infer<typeof removeMaterialSchema>;
export type MaterialFormValues = z.infer<typeof materialFormSchema>;
