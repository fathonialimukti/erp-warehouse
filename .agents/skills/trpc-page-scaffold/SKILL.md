---
name: trpc-page-scaffold
description: 'Scaffold a complete ERP feature end-to-end: Zod schema in @repo/schemas, tRPC router with CRUD procedures, and all three client pages (Index, Detail, Form). Use when adding a new domain to the ERP system, creating a new resource/entity, or scaffolding a new CRUD feature. Triggers on "new feature", "new domain", "scaffold", "add entity", "create resource", "generate pages".'
argument-hint: '<DomainName> (e.g. supplier, vendor, category)'
---

# tRPC Page Scaffold

Generates a complete ERP feature from schema to UI, following the exact patterns in this codebase.

## What It Produces

For a domain named `{Domain}` (e.g. `Supplier`):

| File | Purpose |
|------|---------|
| `packages/schemas/src/{domain}.ts` | Zod schemas for create / update / id input |
| `apps/server/src/routers/{domain}.ts` | tRPC router with `list`, `detail`, `create`, `update`, `delete` |
| `apps/client/src/pages/{domain}/{Domain}IndexPage.tsx` | Paginated list with search, table, delete modal |
| `apps/client/src/pages/{domain}/{Domain}DetailPage.tsx` | Detail view with PageHeader, permission-gated actions |
| `apps/client/src/pages/{domain}/{Domain}FormPage.tsx` | Create + edit form with confirm-modal pattern |

Plus wiring instructions for: router registration, routes, nav menu, locale keys.

## Procedure

### Step 1 — Collect inputs

Ask the user (or infer from the argument):
- **Domain name** — singular PascalCase noun (e.g. `Supplier`)
- **Fields** — list of `fieldName: type` pairs (e.g. `name: string, contactEmail: string, address: string`)
- **Has photo?** — yes/no (adds `photo` field and `<EntityPhoto>` to detail/form)
- **Router namespace** — top-level key in `appRouter` (usually `camelCase(domain)`, e.g. `supplier`). Clarify if it needs a nested router like `warehouse`.
- **Permission prefix** — usually `domainName` lowercase (e.g. `supplier` → `supplier@read`, `supplier@create`, etc.)

### Step 2 — Generate `packages/schemas/src/{domain}.ts`

Use the [schema template](./references/schema-template.md). Key rules:
- Export `create{Domain}Schema`, `update{Domain}Schema`, `{domain}IdSchema`
- `update{Domain}Schema` must include `currentId: z.string()` for tracking the original ID
- Export inferred types: `Create{Domain}Input`, `Update{Domain}Input`, `{Domain}IdInput`
- Add a barrel export line to `packages/schemas/src/index.ts`

### Step 3 — Generate `apps/server/src/routers/{domain}.ts`

Use the [router template](./references/router-template.md). Key rules:
- Import schemas from `@repo/schemas/{domain}` (not `@repo/schemas`)
- Import `{ hasPermission, protectedProcedure, router }` from `'../trpc.js'`
- Import `{ prisma }` from `'../lib/prisma.js'`
- Use `createListInputSchema()`, `buildPaginationParams()`, `buildPaginationMeta()`, `buildTextSearchWhere()` from `'../lib/list-query.js'`
- Use `logActivity` from `'../lib/activity-log.js'`
- Use `buildCreateLogDetail`, `buildUpdateLogDetail`, `buildDeleteLogDetail` from `'../lib/log-detail.js'`
- All procedures use `protectedProcedure.use(hasPermission('{domain}@{action}'))`
- Throw `TRPCError` with correct codes: `NOT_FOUND` for missing records, `CONFLICT` for duplicate IDs

### Step 4 — Register router in `apps/server/src/router.ts`

Add import + registration in `appRouter`. For a simple (non-nested) domain:
```ts
import { {domain}Router } from './routers/{domain}.js';
// in appRouter:
{domain}: {domain}Router,
```

### Step 5 — Generate client pages

Use the templates in:
- [Index page template](./references/index-page-template.md)
- [Detail page template](./references/detail-page-template.md)
- [Form page template](./references/form-page-template.md)

Key rules for all pages:
- `trpcClient.{namespace}.{procedure}.query/mutate()` — match the router namespace exactly
- `queryKey` arrays use `['{domain}List', ...]` and `['{domain}Detail', id]`
- `hasPermissionAtom` from `'../../lib/atoms'` — derive `canCreate`, `canUpdate`, `canDelete`
- All user-visible strings use `intl.formatMessage({ id: '{domain}.{page}.{key}', defaultMessage: '...' })`
- Icons via `<Icon icon="solar:..." />` from `@iconify/react`
- **Never** use `className` or `classNames` on HeroUI components

### Step 6 — Wire up routes in `apps/client/src/routes.tsx`

Add import + route entries. Standard pattern:
```tsx
// Imports
import { {Domain}IndexPage } from './pages/{domain}/{Domain}IndexPage';
import { {Domain}DetailPage } from './pages/{domain}/{Domain}DetailPage';
import { {Domain}FormPage } from './pages/{domain}/{Domain}FormPage';

// Inside PrivateLayout children:
{
  path: '{domain}',
  children: [
    { index: true, element: <{Domain}IndexPage /> },
    { path: ':id', element: <{Domain}DetailPage /> },
    { path: 'create', element: <{Domain}FormPage /> },
    { path: ':id/edit', element: <{Domain}FormPage /> },
  ],
},
```

### Step 7 — Add nav menu entry in `apps/client/src/constants/nav-menu.ts`

Match the existing `NavItem` shape:
```ts
{
  key: '{domain}',
  label: { id: 'nav.{domain}', defaultMessage: '{Domain}s' },
  icon: 'solar:box-linear',       // pick an appropriate solar icon
  path: '/{domain}',
  permission: '{domain}@read',
}
```

### Step 8 — Add i18n keys

Add keys to both `apps/client/src/locales/en.json` and `apps/client/src/locales/id.json`.
Minimum keys:
```json
"{domain}.index.title": "{Domain}s",
"{domain}.index.header_{field}": "{Field Label}",
"{domain}.detail.loading_detail": "Loading {domain} details...",
"{domain}.detail.not_found": "{Domain} not found.",
"{domain}.form.success.created": "{Domain} created successfully.",
"{domain}.form.success.updated": "{Domain} updated successfully.",
"nav.{domain}": "{Domain}s"
```

### Step 9 — Seed permissions

Add the new domain's permissions to `apps/server/src/prisma/seed/permission-seeder.ts`. This is required — without it `hasPermission()` will always throw `FORBIDDEN`.

**In the `PERMISSIONS` array**, add a block (use `// {Domain}` comment for consistency):

```ts
// {Domain}
{ name: '{domain}@create', description: 'Create {domain}s' },
{ name: '{domain}@read',   description: 'Read {domain}s' },
{ name: '{domain}@update', description: 'Update {domain}s' },
{ name: '{domain}@delete', description: 'Delete {domain}s' },
```

**In the `ROLE_PERMISSIONS` map**, add to the relevant roles:

```ts
'System Admin': ['*'],  // already covers everything — no change needed

'Warehouse Manager': [
  // ...existing entries...
  '{domain}@*',         // full access for manager
],

'Warehouse Operator': [
  // ...existing entries...
  '{domain}@read',      // read-only for operator — adjust per business rule
],
```

Then re-run the seed:
```bash
cd apps/server && bun run db:seed
```

> The seed **wipes and recreates** all permissions and roles. Always re-run it after any change to `permission-seeder.ts`.

### Step 10 — Validate

Run `bun run check-types` from the repo root and fix any TypeScript errors before delivering.
