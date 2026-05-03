# Copilot / Cursor / AI Coding Instructions

## Core Principle

**Write the shortest, cleanest, and most maintainable solution** that follows the existing architecture and modern minimalist principles.
Prioritize clarity, simplicity, and consistency over cleverness or premature optimization.

Use:

- **Bun** as runtime, package manager, and script runner
- **TypeScript** (strict mode) for all code
- **React 19** + **Vite** + **Tauri** for the frontend
- **tRPC** (v11+) for end-to-end typesafe communication
- **HeroUI** + **Tailwind CSS** for UI
- **Turborepo** for monorepo management

Always respect the current project structure and recent file edits.
Only refer to file i provided in the context, focus on it and feel free to ask for more files if needed. Do not suggest code that has been deleted in recent edits.
---

**Preferred architecture**: Feature-Sliced Design (light version) — group by **feature** inside `features/` when it grows.

---

## HeroUI Rules (Strict)

- Use **only** HeroUI props, variants, slots, and composition.
- **Never** pass `className` or `classNames` to any HeroUI component.
- If HeroUI cannot achieve the desired UI cleanly, **explicitly state** it and ask for permission before adding custom Tailwind classes.
- Prefer composition (`<HeroCard><HeroButton>...</HeroButton></HeroCard>`) over deep prop drilling.

---

## TypeScript Rules

- Enable `strict: true` and `exactOptionalPropertyTypes`
- Prefer **type inference** wherever possible
- Use `interface` for props and extendable object shapes
- Use `type` for unions, intersections, utility types, and aliases
- Avoid `any`. Use `unknown` or `never` when appropriate
- Never use non-null assertion (`!`) without a clear `// TODO:` or safety comment
- Colocate types close to their usage

---

## React + Frontend Rules

- Functional components only
- Explicitly type props with `interface ComponentProps {}` (avoid `React.FC`)
- Default export for pages and root components
- Named export for reusable components and hooks
- Keep components small, focused, and single-responsibility
- Use **feature folders** (`features/auth`, `features/dashboard`, etc.) for complex modules
- Custom hooks must start with `use` and be colocated in the feature or `hooks/` folder
- Use `useMemo` / `useCallback` / `React.memo` **only** when performance issues are measured
- Prefer **composition** and **context** over heavy prop drilling
- Use **Zustand** or **Jotai** sparingly for global state (only when truly needed)

---

## tRPC Rules (Modern & Clean)

- Use **domain-based nested routers** (`user.ts`, `post.ts`, `settings.ts`)
- All input/output validation with **Zod** — prefer importing from `@repo/schemas`; add locally only when truly domain-specific
- Keep procedures **thin** — move complex logic to `services/`
- Use `TRPCError` with correct error codes (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `CONFLICT`)
- All protected routes must use the shared `protectedProcedure` middleware
- Chain `hasPermission('resource@action')` middleware for permission checks (format is always `resource@action`, **never** `resource_action`)
- On frontend:
  - **CRITICAL**: The client uses a **vanilla** `createTRPCClient` (not `createTRPCReact`). There are NO `trpc.router.useQuery()` hooks. All data fetching uses raw `@tanstack/react-query` with `trpcClient.*` calls in `queryFn`/`mutationFn`.
  - Pattern: `useQuery({ queryKey: [...], queryFn: () => trpcClient.resource.list.query(input) })`
  - `AppRouter` type is imported directly from `../../../server/src/router` (relative monorepo path)
  - Always pass `credentials: 'include'` — already configured in the shared client at [apps/client/src/lib/trpc.ts](../apps/client/src/lib/trpc.ts)
  - Set sensible `staleTime` / `gcTime` based on data volatility

### Router Namespace Map

```
appRouter
├── hello          — public health check
├── auth           — login, logout, me
├── user
├── accessControl  — roles, permissions
├── warehouse      — NESTED: warehouse.warehouse.*, warehouse.storageLocation.*, warehouse.pallet.*, warehouse.layout.*
├── activityLog
├── sku
├── pallet
├── inboundTransaction / outboundTransaction / foundTransaction / lossTransaction
├── upload
└── notification
```

> The `warehouse` namespace is **two levels deep** — calls look like `trpcClient.warehouse.warehouse.list.query()`.

---

## Code Style & Best Practices

- File naming:
  - Components: `PascalCase.tsx`
  - Routers: `domain.ts`
  - Hooks: `usePascalCase.ts`
  - Utils: `kebab-case.ts` or `camelCase.ts`
- Use **arrow functions** consistently
- Prefer early returns: `if (!condition) return ...`
- No magic numbers or strings — extract to well-named constants
- Consistent import order (ESLint enforced)
- Meaningful names > extreme brevity
- Write self-documenting code. Comments only when necessary

### Performance

- Favor React Server Components where possible (if using any SSR)
- Use Tauri’s native capabilities wisely (window, dialog, fs, etc.)
- Keep bundle size in mind — avoid unnecessary dependencies

### Accessibility & Design

- Leverage HeroUI’s built-in accessibility features
- Follow modern minimalist design: generous whitespace, clean typography, subtle interactions
- Ensure high contrast and keyboard navigation

---

## Important Reminders

- **Always check recent file edits** before suggesting changes to existing files.
- Do **not** suggest deleted code.
- Prioritize **readability and maintainability** above all.
- Keep the app **modern and minimalist** in both code and UI.
- If you need to deviate from these rules, **explain why clearly** first.
- When in doubt, choose the **simplest solution** that respects the architecture.

Follow these instructions **strictly** for every code suggestion and generation.

---

## Project Architecture

### Monorepo Structure

```
apps/client/     — React 19 + Vite + Tauri frontend (port: Vite default)
apps/server/     — Express + tRPC v11 backend (port: 2022)
packages/schemas — Shared Zod schemas (@repo/schemas) — use these first before defining locally
packages/ui      — Turborepo scaffold placeholder, NOT used by client (client uses @heroui/react directly)
```

### Build & Dev Commands

| Scope | Command | What it does |
|-------|---------|--------------|
| Root | `bun run dev` | Start all apps via Turbo |
| Root | `bun run build` | Build all apps |
| Root | `bun run check-types` | Type-check all packages |
| Server | `bun run db:migrate` | Run Prisma migrations |
| Server | `bun run db:seed` | Seed roles, permissions, admin user |
| Server | `bun run db:studio` | Open Prisma Studio |
| Server | `bun run db:push` | Push schema without migration (dev only) |
| Server | `bun run test` | Run Vitest tests |

### Server Required Env Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — | PostgreSQL connection string (**required**) |
| `JWT_SECRET` | `'your-secret-key-change-this'` | **Must override in prod** |
| `PORT` | `2022` | HTTP port |
| `CORS_ORIGIN` | — | Production origin; dev allows all `localhost:*` + `tauri://localhost` |

---

## Database (Prisma + PostgreSQL)

- **PostgreSQL** via `pg` pool + `@prisma/adapter-pg` (driver adapter mode)
- Schema: [apps/server/src/prisma/schema.prisma](../apps/server/src/prisma/schema.prisma)
- Generated client: `apps/server/src/prisma/generated/` (non-standard — **not** `node_modules/.prisma`)
- Import Prisma client from `'../prisma/generated'` inside the server package
- All IDs use `@default(ulid())` — never use numeric auto-increment or UUID
- Key enums: `ApprovalStatus` (`DRAFT | PROPOSED | APPROVED | REJECTED`), `PalletStatus`, `StorageLocationStatus`

---

## Authentication & Permissions

- **Cookie-based auth** (`access_token` HTTP-only cookie) with `Authorization: Bearer` fallback
- Client auth state lives in Jotai atoms (persisted to localStorage): `authUserAtom`, `authTokenAtom`, `userPermissionsAtom`, `hasPermissionAtom`
- `useAuthBootstrap()` is called once in `App.tsx` — fetches `auth.me`, populates atoms
- `ProtectedRoute` returns `null` until `authBootstrapReadyAtom` is true
- Permission format is **always `resource@action`** (e.g. `warehouse@create`, `user@delete`). Never use underscore separator.
- In components: read permissions via `const hasPermission = useAtomValue(hasPermissionAtom)` → `hasPermission('warehouse@read')`
- Sidebar nav items declare `permission: string | string[]`; invisible if user lacks permission

---

## Frontend Patterns

### Index Page Template

1. `const hasPermission = useAtomValue(hasPermissionAtom)` → derive `canCreate`, `canUpdate`, `canDelete`
2. `useQuery` with `trpcClient.*.list.query({ page, limit, search })`
3. Debounced search (300ms) + TanStack Table for columns
4. Delete modal state (`deleteModalOpen`, `itemToDelete`)
5. HeroUI: `Card`, `Table`, `Input`, `Button`, `Dropdown`, `Pagination`, `Modal`, `Spinner`
6. Icons via `@iconify/react` `<Icon icon="solar:..." />`

### Detail Page Template

1. `<PageHeader>` with `title`, `onBack`, `onEdit`, `onDelete` (permission-gated)
2. `useQuery` for detail data
3. `<EntityPhoto>` for photos
4. Permission-gated action buttons
5. Inline delete confirmation modal

### Form Page Template

Split into two components: an **outer** loader and an **inner** form.

**Outer component** (`<ResourceFormPage>`):
1. `useParams` to get `id`; derive `isEdit = Boolean(id)`
2. `useQuery` for detail data (enabled only when `isEdit`)
3. `useQuery` for any dependent list data (e.g. SKU list, warehouse list)
4. Guard renders: loading spinner modal → not-found modal → edit-blocked modal (when `approvalStatus` is not editable)
5. Pass `initialValues` (transformed from detail data) and list data as props to inner form

**Inner form component** (`<ResourceForm>`):
1. `const hasPermission = useAtomValue(hasPermissionAtom)` → derive `canSave`
2. Modal state machine: `type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error'`
3. `useMutation` for create and update; `onSuccess` invalidates queries, sets `modalStage` to `'success'`, auto-navigates after 1500ms
4. `useForm` from `@tanstack/react-form` with Zod `safeParse` in `onChange` validator; `onSubmit` builds payload and calls `mutateAsync`
5. `intentRef = useRef<'DRAFT' | 'PROPOSED'>` — set before opening confirm modal
6. Layout: `<PageHeader>` → `<Form>` → `<section>` with grid of `<Fieldset>` sections → items `<Card>` → action `<Button>` row → single action `<Modal>`
7. Modal renders four states inline: `loading` (Spinner), `success` (auto-dismiss), `error` (dismiss), `confirm` (approve/cancel)
8. All labels and messages via `intl.formatMessage`

**Data transform**:
- `defaultFormValues()` — returns blank form state
- `transformDetailToFormValues(data)` — maps API response to form shape; called only when `isEdit && detailQuery.data`

**Export**: named export `{ ResourceFormPage }` (outer component only)

### i18n

- Library: `react-intl` v6 — `IntlProvider` in [apps/client/src/providers.tsx](../apps/client/src/providers.tsx)
- Locales: `en` and `id` (Indonesian) — files at `apps/client/src/locales/`
- Usage: `const intl = useIntl(); intl.formatMessage({ id: 'key.path', defaultMessage: 'Fallback' })`
- Locale persisted as Jotai atom + cookie
