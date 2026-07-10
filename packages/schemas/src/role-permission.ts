import { z } from 'zod';

// Role schemas
export const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateRoleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const roleIdSchema = z.object({
  id: z.string(),
});

// Form schema — description is always string in form (empty string = no description)
export const roleFormSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string(),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

// Permission schemas
export const createPermissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const updatePermissionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const permissionIdSchema = z.object({
  id: z.string(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleIdInput = z.infer<typeof roleIdSchema>;
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
export type PermissionIdInput = z.infer<typeof permissionIdSchema>;