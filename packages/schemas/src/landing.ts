import { z } from "zod";

// Public landing contact form — persisted by landing.submitContact.
// Max lengths bound the anonymous write (5mb global body cap is not enough alone).
export const submitContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(255),
  company: z.string().max(100).optional(),
  message: z.string().min(1, "Message is required").max(5000),
});

export type SubmitContactInput = z.infer<typeof submitContactSchema>;

// Owner-facing list of contact inquiries (landing.listContactSubmissions).
// The object default lets callers omit the whole input while still getting
// the pagination defaults below.
export const listContactSubmissionsSchema = z
  .object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(50),
    search: z.string().max(100).optional(),
  })
  .default({ page: 1, limit: 50 });

export type ListContactSubmissionsInput = z.infer<
  typeof listContactSubmissionsSchema
>;
