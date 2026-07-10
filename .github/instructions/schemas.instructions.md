---
description: "Use when creating or editing Zod schemas in packages/schemas/src/. Covers schema naming conventions, update schema pattern, barrel exports, and ID conventions."
applyTo: "packages/schemas/src/**"
---

# Shared Schema Conventions (`@repo/schemas`)

## Before Creating a New Schema

Always check if a schema for the domain already exists in `packages/schemas/src/`. Import from the individual file — not the barrel:

```ts
import { createWarehouseSchema } from '@repo/schemas/warehouse';
```

## Schema File Structure

```ts
import { z } from 'zod';

// Create schema — all fields for creation
export const create{Domain}Schema = z.object({
  // All IDs use ULID — never generate numeric or UUID ids manually
  // Do NOT include `id` here; it is set by @default(ulid()) in Prisma
  name: z.string().min(1),
});

// Update schema — extends create, adds `currentId` to track original ID before potential rename
export const update{Domain}Schema = create{Domain}Schema.extend({
  currentId: z.string(),
});

// ID-only schema for detail/delete procedures
export const {domain}IdSchema = z.object({ id: z.string() });

// Inferred types
export type Create{Domain}Input = z.infer<typeof create{Domain}Schema>;
export type Update{Domain}Input = z.infer<typeof update{Domain}Schema>;
```

## Rules

- `update*Schema` **must** include `currentId: z.string()` — required for activity logging and rename tracking
- Never define Zod schemas locally in a router if they belong here
- After adding a new file, add a barrel export in `packages/schemas/src/index.ts`
- Keep schemas minimal — no UI-only validation logic in shared schemas
