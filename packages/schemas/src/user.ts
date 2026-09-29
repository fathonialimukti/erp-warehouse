import { z } from "zod";

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleId: z.string().min(1, "Role is required"),
  photo: z.string().optional(),
});

export const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email").optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  roleId: z.string().min(1, "Role is required").optional(),
  photo: z.string().optional(),
});

// Client-side form validation schemas (without photo, handled separately)
// password is always string in the form (empty string = keep existing on update)
export const createUserFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleId: z.string().min(1, "Role is required"),
});

export const updateUserFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string(),
  roleId: z.string().min(1, "Role is required"),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>;

export const userIdSchema = z.object({
  id: z.string(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
