import { z } from "zod";
import { createListInputSchema } from "./common";

export const productListInputSchema = createListInputSchema();
export const productIdSchema = z.object({ id: z.string() });

const productFieldsShape = {
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  photo: z.string().optional(),
  baseUnit: z.string().optional(),
  objectId: z.string().optional(),
  packageName: z.string().min(1, "Package name is required"),
  packagesPerPallet: z.number().int().min(1, "Packages per pallet is required"),
  quantityPerPackage: z.number().min(0, "Quantity per package is required"),
  packageUnit: z.string().min(1, "Package unit is required"),
  length: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  maxWeight: z.number().optional(),
};

/** Input schema for creating a finished-good product (type = FINISHED_GOOD). */
export const createProductSchema = z
  .object({
    id: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    ...productFieldsShape,
  })
  .refine((v) => Boolean(v.id?.trim() || v.code?.trim()), {
    message: "Code is required",
    path: ["code"],
  });

/** Input schema for updating a finished-good product. `currentId` is the lookup key. */
export const updateProductSchema = z.object({
  currentId: z.string(),
  code: z.string().min(1, "Code is required"),
  ...productFieldsShape,
});

/** Client-side form schema for the product create/edit form. */
export const productFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  ...productFieldsShape,
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
