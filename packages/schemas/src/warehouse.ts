import { z } from 'zod';

// Warehouse schemas
export const createWarehouseSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  totalCapacity: z.number().int().optional(),
  photo: z.string().optional(),
});

export const updateWarehouseSchema = z.object({
  currentId: z.string(),
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  totalCapacity: z.number().int().optional(),
  photo: z.string().optional(),
});

export const warehouseIdSchema = z.object({
  id: z.string(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type WarehouseIdInput = z.infer<typeof warehouseIdSchema>;