---
description: "Use when writing tRPC routers, Prisma queries, server-side procedures, database mutations, or any file in apps/server/src/. Covers Prisma client import path, procedure tiers, permission guards, activity logging, and list query utilities."
applyTo: "apps/server/src/**"
---

# Server-Side Conventions

## Prisma Client

- Import from `'../prisma/generated/client'` (non-standard path — **not** `@prisma/client`)
- Import the singleton instance from `'../lib/prisma.js'`:
  ```ts
  import { prisma } from '../lib/prisma.js';
  // or inside a transactional procedure, use ctx.db instead of prisma
  ```
- `DbClient` type (union of `PrismaClient` and `Prisma.TransactionClient`) is exported from `'../lib/prisma.js'`
- All model IDs use `@default(ulid())` — never generate numeric or UUID ids manually

## Procedure Tiers

Three exports from `'../trpc.js'`:

| Export | Auth | Transaction |
|--------|------|-------------|
| `publicProcedure` | None | No |
| `protectedProcedure` | JWT required | No |
| `transactionalProtectedProcedure` | JWT required | Wrapped in `prisma.$transaction` |

Use `transactionalProtectedProcedure` only when a mutation touches multiple models atomically. Inside it, use `ctx.db` (not `prisma` directly) so it participates in the transaction.

## Permission Guards

Chain `.use(hasPermission('resource@action'))` after `protectedProcedure`:

```ts
import { hasPermission, protectedProcedure, router } from '../trpc.js';

list: protectedProcedure.use(hasPermission('warehouse@read'))
```

- Format is always `resource@action` — never `resource_action`
- `hasPermission` accepts a single string or an array (any-of match)
- `normalizePermission` in `trpc.ts` normalises legacy `resource_action` → `resource@action` automatically; always write new permissions with `@`

## Context Shape (`RequestContext`)

```ts
ctx.user      // AuthUser | null  — { userId, email, name, exp }
ctx.db        // DbClient — use inside transactional procedures
ctx.locale    // ServerLocale — pass to getMessage() for error messages
ctx.req       // Express Request — needed for file uploads
ctx.res       // Express Response
```

Use `getMessage(ctx.locale, 'key')` from `'../lib/locale.js'` for localised error messages in `TRPCError`.

## Error Codes

| Situation | Code |
|-----------|------|
| Resource not found | `NOT_FOUND` |
| Not logged in | `UNAUTHORIZED` |
| Lacks permission | `FORBIDDEN` |
| Invalid input not caught by Zod | `BAD_REQUEST` |
| Duplicate ID / unique constraint | `CONFLICT` |

## List Query Utilities (`'../lib/list-query.js'`)

```ts
import {
  createListInputSchema,        // Zod input schema with page/limit/search
  buildPaginationParams,        // { page, limit, skip } from input
  buildPaginationMeta,          // { total, totalPages, page, limit }
  buildTextSearchWhere,         // Prisma `where` for multi-field insensitive search
} from '../lib/list-query.js';

// Usage:
.input(createListInputSchema())
.query(async ({ input }) => {
  const { page, limit, skip } = buildPaginationParams(input);
  const where = buildTextSearchWhere(input?.search, ['name', 'id'] as const);
  const [data, total] = await Promise.all([
    prisma.model.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.model.count({ where }),
  ]);
  return { data, meta: buildPaginationMeta({ page, limit, total }) };
})
```

## Activity Logging

Every create / update / delete mutation must call `logActivity`:

```ts
import { logActivity } from '../lib/activity-log.js';
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from '../lib/log-detail.js';

await logActivity(prisma, {
  action: 'CREATE',           // 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | ...
  userId: ctx.user.userId,
  resource: 'warehouse',      // lowercase domain name
  resourceId: created.id,
  message: `Created warehouse ${created.name}`,
  detail: buildCreateLogDetail(created),
});
```

- For UPDATE: `detail: buildUpdateLogDetail(existingRecord, updatedRecord)`
- For DELETE: `detail: buildDeleteLogDetail(existingRecord)`

## Schemas

- Import from `@repo/schemas/{domain}` (individual file, not the barrel `@repo/schemas`)
- Always prefer `@repo/schemas` over defining Zod schemas locally in a router
- `update*Schema` must include `currentId: z.string()` for tracking the original ID before potential rename

## Router Registration

After creating a new router file, register it in `apps/server/src/router.ts`:

```ts
import { {domain}Router } from './routers/{domain}.js';
// in appRouter:
{domain}: {domain}Router,
```

All imports inside `apps/server/src/` use `.js` extensions (ESM output target).
