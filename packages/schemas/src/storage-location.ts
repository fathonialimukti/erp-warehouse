import { z } from 'zod';

// Storage location status values
export const storageLocationStatusValues = ['ACTIVE', 'MAINTENANCE', 'FULL'] as const;
export const storageLocationStatusSchema = z.enum(storageLocationStatusValues);

// Storage location schemas
export const createStorageLocationSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  id: z.string().min(1, 'ID is required'),
  status: storageLocationStatusSchema.optional(),
});

export const updateStorageLocationSchema = z.object({
  currentId: z.string(),
  id: z.string().min(1, 'ID is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  status: storageLocationStatusSchema.optional(),
});

export const storageLocationIdSchema = z.object({
  id: z.string(),
});

export const storageLocationByWarehouseSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
});

// Import schema for bulk operations
export const storageLocationImportRowSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  id: z.string().min(1, 'ID is required'),
  status: storageLocationStatusSchema.optional(),
});

export type StorageLocationStatus = z.infer<typeof storageLocationStatusSchema>;
export type CreateStorageLocationInput = z.infer<typeof createStorageLocationSchema>;
export type UpdateStorageLocationInput = z.infer<typeof updateStorageLocationSchema>;
export type StorageLocationIdInput = z.infer<typeof storageLocationIdSchema>;
export type StorageLocationByWarehouseInput = z.infer<typeof storageLocationByWarehouseSchema>;
export type StorageLocationImportRow = z.infer<typeof storageLocationImportRowSchema>;