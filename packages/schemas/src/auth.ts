import { z } from "zod";

// Auth schemas
export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const demoLoginSchema = z.object({
  userId: z.string().min(1),
});

export type DemoLoginInput = z.infer<typeof demoLoginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(128),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.email("Invalid email address"),
});

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(128),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
