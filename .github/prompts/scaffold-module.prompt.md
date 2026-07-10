---
description: "Scaffold a new ERP module end-to-end — either a simple CRUD module (like users or warehouse) or an approval workflow module (like inbound transactions). Generates Zod schema, tRPC router, client pages, routes, locale keys, and nav menu wiring."
name: "Scaffold Module"
argument-hint: "<simple|approval> <DomainName> [field: type, ...]"
agent: "ERP 3D HeroUI Builder"
---

# Scaffold ERP Module

You are scaffolding a complete ERP module from schema to UI in this monorepo workspace.

## Step 1 — Collect inputs

If not fully provided in the argument, ask the user for:

| Input | Example |
|-------|---------|
| **Module type** | `simple` or `approval` |
| **Domain name** (singular PascalCase) | `Supplier`, `OutboundTransaction` |
| **Fields** (name: type pairs) | `name: string, address: string, capacity: number` |
| **Has photo?** | yes / no |
| **Has file attachments?** | yes / no *(approval modules usually yes)* |
| **Has line items?** | yes / no *(approval modules usually yes)* |
| **Router namespace** | top-level key in `appRouter`, e.g. `supplier`. Nested routers (like `warehouse`) must be explicitly stated. |
| **Permission resource** | snake_case resource name, e.g. `supplier`, `inbound_transaction`. Used in `resource@action` format. |
| **Nav menu placement** | parent group in `apps/client/src/constants/nav-menu.ts` |
| **Locale key prefix** | e.g. `supplier`, `inbound_transaction` |

---

## Step 2 — Read reference files before generating

Always read these before writing any code:

- [apps/server/src/routers/inbound-transaction.ts](../../apps/server/src/routers/inbound-transaction.ts) — approval module router reference
- [apps/server/src/lib/transaction.ts](../../apps/server/src/lib/transaction.ts) — shared approval utilities
- [apps/client/src/pages/users/UsersIndexPage.tsx](../../apps/client/src/pages/users/UsersIndexPage.tsx) — simple index reference
- [apps/client/src/pages/users/UserDetailPage.tsx](../../apps/client/src/pages/users/UserDetailPage.tsx) — simple detail reference
- [apps/client/src/pages/users/UserFormPage.tsx](../../apps/client/src/pages/users/UserFormPage.tsx) — simple form reference
- [apps/client/src/pages/transactions/inbound/_InboundTransactionTable.tsx](../../apps/client/src/pages/transactions/inbound/_InboundTransactionTable.tsx) — approval index reference
- [apps/client/src/pages/transactions/inbound/InboundTransactionDetailPage.tsx](../../apps/client/src/pages/transactions/inbound/InboundTransactionDetailPage.tsx) — approval detail reference
- [apps/client/src/pages/transactions/inbound/InboundTransactionFormPage.tsx](../../apps/client/src/pages/transactions/inbound/InboundTransactionFormPage.tsx) — approval form reference
- [apps/client/src/lib/trpc.ts](../../apps/client/src/lib/trpc.ts) — trpcClient setup
- [apps/server/src/router.ts](../../apps/server/src/router.ts) — appRouter registration
- [apps/client/src/routes.tsx](../../apps/client/src/routes.tsx) — route registration
- [apps/client/src/constants/nav-menu.ts](../../apps/client/src/constants/nav-menu.ts) — nav menu
- [apps/client/src/locales/en.json](../../apps/client/src/locales/en.json) — en locale keys
- [apps/client/src/locales/id.json](../../apps/client/src/locales/id.json) — id locale keys

---

## Step 3 — Generate files

### Files to produce (both module types)

| File | Notes |
|------|-------|
| `packages/schemas/src/{domain}.ts` | Zod schemas |
| `packages/schemas/src/index.ts` | Add barrel export |
| `apps/server/src/routers/{domain}.ts` | tRPC router |
| `apps/server/src/router.ts` | Register router |
| `apps/client/src/pages/{domain}/{Domain}IndexPage.tsx` | Index/list page |
| `apps/client/src/pages/{domain}/{Domain}DetailPage.tsx` | Detail page |
| `apps/client/src/pages/{domain}/{Domain}FormPage.tsx` | Form page (outer + inner) |
| `apps/client/src/routes.tsx` | Register routes |
| `apps/client/src/constants/nav-menu.ts` | Add nav item |
| `apps/client/src/locales/en.json` | English locale keys |
| `apps/client/src/locales/id.json` | Indonesian locale keys |

---

## Module Type Specifications

### ── SIMPLE MODULE ──────────────────────────────────────────────────────

Use as reference: Users, Warehouse modules.

**Zod schema** (`packages/schemas/src/{domain}.ts`):
```ts
export const create{Domain}Schema = z.object({ /* fields */ });
export const update{Domain}Schema = create{Domain}Schema.extend({ currentId: z.string() });
export const {domain}IdSchema = z.object({ id: z.string() });
export type Create{Domain}Input = z.infer<typeof create{Domain}Schema>;
export type Update{Domain}Input = z.infer<typeof update{Domain}Schema>;
```

**tRPC router** procedures:
- `list` — `protectedProcedure.use(hasPermission('{resource}@read'))`, paginated with search, uses `createListInputSchema`, `buildPaginationParams`, `buildPaginationMeta`, `buildTextSearchWhere`
- `detail` — `protectedProcedure.use(hasPermission('{resource}@read'))`, throws `NOT_FOUND`
- `create` — `protectedProcedure.use(hasPermission('{resource}@create'))`, logs with `logActivity` + `buildCreateLogDetail`
- `update` — `protectedProcedure.use(hasPermission('{resource}@update'))`, logs with `buildUpdateLogDetail`
- `delete` — `protectedProcedure.use(hasPermission('{resource}@delete'))`, logs with `buildDeleteLogDetail`

**Index page** (`{Domain}IndexPage.tsx`):
- `const hasPermission = useAtomValue(hasPermissionAtom)` → `canCreate`, `canUpdate`, `canDelete`
- `useQuery` with `trpcClient.{namespace}.list.query({ page, limit, search })`
- 300ms debounced search + `useState<PaginationState>`
- TanStack Table columns + `flexRender`
- Delete modal: `deleteModalOpen`, `itemToDelete` state
- HeroUI: `Card`, `Table`, `Input`, `Button`, `Dropdown`, `Pagination`, `Modal`, `Spinner`

**Detail page** (`{Domain}DetailPage.tsx`):
- `<PageHeader>` with `onBack`, `onEdit` (permission-gated), optional `onDelete`
- `useQuery` for detail
- `<EntityPhoto>` if has photo
- Inline delete confirmation modal using `ModalAction` state: `'idle' | 'confirm-delete' | 'loading' | 'success' | 'error'`

**Form page** (`{Domain}FormPage.tsx`) — split into outer + inner:

*Outer* (`{Domain}FormPage`):
- `useParams` → `isEdit = Boolean(id)`
- `useQuery` for detail (enabled only when `isEdit`)
- Guards: loading spinner modal → not-found modal
- Props passed down: `initialValues`, dependent list data

*Inner* (`{Domain}Form`):
- `const hasPermission = useAtomValue(hasPermissionAtom)` → `canSave`
- `type ModalStage = 'idle' | 'confirm-save' | 'loading' | 'success' | 'error'`
- `useMutation` for create and update; `onSuccess` invalidates queries, navigates after 1500ms
- `useForm` from `@tanstack/react-form` with Zod `safeParse` in `onChange`
- Layout: `<PageHeader>` → `<Form>` → `<section>` grid of `<Fieldset>` → action `<Button>` row → `<Modal>`
- Named export: `{ {Domain}FormPage }`

---

### ── APPROVAL MODULE ─────────────────────────────────────────────────────

Use as reference: Inbound Transaction. Extends the simple module with approval workflow.

**Additional Prisma fields** (must exist in schema):
- `approvalStatus String @default("DRAFT")`
- `approvalHistory Json @default("[]")`
- `transactionCode String? @unique` (optional, auto-generated)
- `warehouseId String` (or relevant location FK)

**Additional tRPC router** procedures (on top of simple CRUD):
```ts
// Import shared approval utilities:
import {
  buildApprovalActionData,
  buildTransactionBaseWhere,
  ensureActionableApprovalStatus,
  ensureDraftOnly,
  ensureDraftOrRejected,
  approvalHistorySchema,
  transactionApprovalStatusSchema,
  transactionListInputSchema,
} from '../lib/transaction.js';
import { transactional } from '../trpc.js';
```
- `propose` — `protectedProcedure.use(hasPermission('{resource}@update'))`, calls `ensureDraftOnly`, `buildApprovalActionData` with `"PROPOSED"`
- `approve` — `protectedProcedure.use(hasPermission('{resource}@approve'))`, calls `ensureActionableApprovalStatus`, `buildApprovalActionData` with `"APPROVED"`
- `reject` — `protectedProcedure.use(hasPermission('{resource}@approve'))`, calls `ensureActionableApprovalStatus`, `buildApprovalActionData` with `"REJECTED"`
- `create` and `update` must use `transactional` middleware and `ensureDraftOrRejected`

**Input schema** additions:
```ts
approvalStatus: transactionApprovalStatusSchema.optional(),
message: z.string().optional(),
approvalHistory: approvalHistorySchema,
items: z.array(itemSchema).min(1, ...),  // if has line items
files: z.array(fileSchema).optional(),   // if has attachments
```

**Index page** (`{Domain}IndexPage.tsx` or `_{Domain}Table.tsx`):
- If transactions share a parent tab layout, create `_{Domain}Table.tsx` component (named export) instead of a standalone page
- Import `ApprovalStatusChip`, `TransactionListLayout`, `TableEmptyStateContent`, `TableLoadingRow` from `../shared`
- `approvalStatus` column rendered with `<ApprovalStatusChip status={...} />`
- Filter state for `approvalStatus` (optional but recommended)

**Detail page** (`{Domain}DetailPage.tsx`):
- Import `{ ApprovalHistory }` from `'../../../components/ApprovalHistory'`
- `const canApprove = hasPermission('{resource}@approve')`
- `type ModalAction = 'idle' | 'confirm-propose' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error'`
- `actionRef = useRef<'propose' | 'approve' | 'reject'>('propose')`
- Three mutations: `proposeMutation`, `approveMutation`, `rejectMutation`
- PageHeader `onEdit` is conditionally shown: only when `['DRAFT', 'REJECTED'].includes(data?.approvalStatus ?? '')`
- Render `<ApprovalHistory data={data?.approvalHistory} />` section
- Show line items table if applicable
- Show file attachments list if applicable

**Form page** (`{Domain}FormPage.tsx`):

*Outer component* additions:
- Guard: edit-blocked modal when `!['DRAFT', 'REJECTED'].includes(detailData?.approvalStatus)`

*Inner form* additions:
- `intentRef = useRef<'DRAFT' | 'PROPOSED'>('DRAFT')`
- `type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error'`
- Two action buttons: **Save as Draft** (sets `intentRef.current = 'DRAFT'`, opens `'confirm-draft'`) and **Submit for Approval** (sets `intentRef.current = 'PROPOSED'`, opens `'confirm-propose'`)
- Line items section: add/remove rows with sort order
- File attachment section if has attachments: file picker → `readFileAsDataUrl` → store in form state

---

## Step 4 — Locale keys to add

### Simple module minimum keys

```json
"{domain}.index.title": "...",
"{domain}.index.add_button": "...",
"{domain}.index.search_placeholder": "...",
"{domain}.index.delete_confirm_title": "...",
"{domain}.index.delete_confirm_message": "...",
"{domain}.detail.title": "...",
"{domain}.form.title_create": "...",
"{domain}.form.title_edit": "...",
"{domain}.form.save_button": "...",
"{domain}.form.confirm_save_title": "...",
"{domain}.form.confirm_save_message": "...",
"{domain}.not_found": "...",
"{domain}.delete_success": "...",
"{domain}.save_success": "..."
```

### Approval module additional keys

```json
"{domain}.form.title_create": "...",
"{domain}.form.save_draft_button": "Save as Draft",
"{domain}.form.propose_button": "Submit for Approval",
"{domain}.form.confirm_draft_title": "...",
"{domain}.form.confirm_propose_title": "...",
"{domain}.propose_success": "...",
"{domain}.approve_success": "...",
"{domain}.reject_success": "...",
"{domain}.status.DRAFT": "Draft",
"{domain}.status.PROPOSED": "Pending Approval",
"{domain}.status.APPROVED": "Approved",
"{domain}.status.REJECTED": "Rejected"
```

---

## Step 5 — Wiring

### Routes (`apps/client/src/routes.tsx`)
```tsx
import { {Domain}IndexPage } from './pages/{domain}/{Domain}IndexPage';
import { {Domain}DetailPage } from './pages/{domain}/{Domain}DetailPage';
import { {Domain}FormPage } from './pages/{domain}/{Domain}FormPage';

// Inside PrivateLayout children:
{ path: '/{domain}', element: <{Domain}IndexPage /> },
{ path: '/{domain}/:id', element: <{Domain}DetailPage /> },
{ path: '/{domain}/form', element: <{Domain}FormPage /> },
{ path: '/{domain}/form/:id', element: <{Domain}FormPage /> },
```

### Nav menu (`apps/client/src/constants/nav-menu.ts`)
```ts
{
  label: intl.formatMessage({ id: '{domain}.nav_label', defaultMessage: '...' }),
  href: '/{domain}',
  icon: 'solar:...',
  permission: '{resource}@read',
}
```

### Router registration (`apps/server/src/router.ts`)
```ts
import { {domain}Router } from './routers/{domain}.js';
// in appRouter:
{domain}: {domain}Router,
```

---

## Rules

- **Never** add `className` or `classNames` to HeroUI components
- **Never** use `React.FC` — type props with `interface {Component}Props {}`
- All user-visible strings via `intl.formatMessage({ id: '...', defaultMessage: '...' })`
- Icons via `<Icon icon="solar:..." />` from `@iconify/react`
- All IDs use ULID (`@default(ulid())`) — never numeric auto-increment
- Permission format: `resource@action` — resource part can use underscores for multi-word names (e.g. `inbound_transaction@read`)
- Import `trpcClient` and `AppRouterType` from `'../../lib/trpc'` (adjust relative depth)
- Import `hasPermissionAtom` from `'../../lib/atoms'`
- Named export for all reusable components and form pages; default export for standalone pages
- Read existing files before editing — never delete code not shown in context
