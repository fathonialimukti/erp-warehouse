# Schema Template

File: `packages/schemas/src/{domain}.ts`

Replace `{Domain}` / `{domain}` with the actual domain name.

```ts
import { z } from 'zod';

export const create{Domain}Schema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  // Add domain-specific fields here
});

export const update{Domain}Schema = z.object({
  currentId: z.string(),              // original ID — required for update routing
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  // Mirror create fields
});

export const {domain}IdSchema = z.object({
  id: z.string(),
});

export type Create{Domain}Input = z.infer<typeof create{Domain}Schema>;
export type Update{Domain}Input = z.infer<typeof update{Domain}Schema>;
export type {Domain}IdInput = z.infer<typeof {domain}IdSchema>;
```

## Barrel export

Add to `packages/schemas/src/index.ts`:

```ts
export * from './{domain}';
```
