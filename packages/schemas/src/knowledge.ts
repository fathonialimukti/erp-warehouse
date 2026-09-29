import { z } from "zod";
import { createListInputSchema } from "./common";

export const knowledgeListInputSchema = createListInputSchema();

export const knowledgeIdSchema = z.object({
  id: z.string().min(1),
});

const knowledgeSlugSchema = z
  .string()
  .min(1, "Slug is required")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be kebab-case (a-z, 0-9, hyphens)",
  );

export const createKnowledgeDocumentSchema = z.object({
  slug: knowledgeSlugSchema,
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  isActive: z.boolean().optional().default(true),
});

export const updateKnowledgeDocumentSchema = createKnowledgeDocumentSchema
  .partial()
  .extend({ id: z.string().min(1) });

export const reindexKnowledgeSchema = z.object({
  id: z.string().min(1).optional(),
});

/** Client form schema — mirrors create fields without defaults that break form typing. */
export const knowledgeFormSchema = z.object({
  slug: knowledgeSlugSchema,
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  isActive: z.boolean(),
});

export type CreateKnowledgeDocumentInput = z.infer<
  typeof createKnowledgeDocumentSchema
>;
export type UpdateKnowledgeDocumentInput = z.infer<
  typeof updateKnowledgeDocumentSchema
>;
export type KnowledgeFormValues = z.infer<typeof knowledgeFormSchema>;
