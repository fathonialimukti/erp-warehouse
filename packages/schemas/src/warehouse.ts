import { z } from 'zod';

// Warehouse schemas
export const createWarehouseSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  objectId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  totalCapacity: z.number().int().optional(),
  photo: z.string().optional(),
});

export const updateWarehouseSchema = z.object({
  currentId: z.string(),
  id: z.string().min(1, 'ID is required'),
  objectId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  totalCapacity: z.number().int().optional(),
  photo: z.string().optional(),
});

export const warehouseIdSchema = z.object({
  id: z.string(),
});

// Form schemas — field names match form state (warehouseId, warehouseName vs API id, name)
export const createWarehouseFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse code is required.'),
  objectId: z.string(),
  warehouseName: z.string().min(1, 'Warehouse name is required.'),
  address: z.string().min(1, 'Address is required.'),
  totalCapacity: z.string().refine(
    (v) => !v.trim() || !Number.isNaN(Number(v)),
    { message: 'Total capacity must be a number.' },
  ),
});

export const updateWarehouseFormSchema = createWarehouseFormSchema;

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type WarehouseIdInput = z.infer<typeof warehouseIdSchema>;
export type CreateWarehouseFormValues = z.infer<typeof createWarehouseFormSchema>;