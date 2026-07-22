---
description: "Use when writing React components, pages, hooks, or any file in apps/client/src/ (excluding locales). Covers tRPC client patterns, HeroUI rules, auth/permission patterns, and page component conventions."
applyTo: "apps/client/src/**"
---

# Client-Side Conventions

## Skills & MCP (when relevant)

- Skills: `heroui-react`, `trpc` (API shape only — still use vanilla client below), `r3f-*` / `three-best-practices` for 3D, `ai-sdk` / `ai-elements` for AI UI
- MCP: `heroui-react/*`, `context7/*`, `threejs-devtools/*` (live scene; app must be running)
- Prefer this file's HeroUI + tRPC rules over generic skill examples

## tRPC — CRITICAL

The client uses a **vanilla** `createTRPCClient` — **NOT** `createTRPCReact`. There are no `trpc.router.useQuery()` hooks.

All data fetching goes through raw `@tanstack/react-query`:

```ts
import { trpcClient } from '../../lib/trpc';

// Query
useQuery({ queryKey: ['resource', 'list', input], queryFn: () => trpcClient.resource.list.query(input) });

// Mutation
useMutation({ mutationFn: (data) => trpcClient.resource.create.mutate(data) });
```

- Import `trpcClient` and `AppRouterType` from `'../../lib/trpc'` (adjust relative depth)
- `credentials: 'include'` is already configured in the shared client — do not add it per-call
- The `warehouse` namespace is **two levels deep**: `trpcClient.warehouse.warehouse.list.query()`

## HeroUI — CRITICAL

- **Never** pass `className` or `classNames` to any HeroUI component
- Use only HeroUI props, variants, slots, and composition
- Prefer HeroUI compound components over custom HTML

## Auth & Permissions

```ts
import { hasPermissionAtom } from '../../lib/atoms';

const hasPermission = useAtomValue(hasPermissionAtom);
const canCreate = hasPermission('warehouse@create');
```

- Permission format is always `resource@action` (e.g. `warehouse@read`, `user@delete`)
- Gate UI elements with `canCreate`, `canUpdate`, `canDelete` derived from `hasPermission`
- `ProtectedRoute` returns `null` until `authBootstrapReadyAtom` is true — never assume auth is ready

## Component Conventions

- Functional components only — type props with `interface ComponentProps {}`, never `React.FC`
- Default export for standalone pages; named export for reusable components and form pages
- Icons: `<Icon icon="solar:..." />` from `@iconify/react`
- All user-visible strings via `intl.formatMessage({ id: '...', defaultMessage: '...' })`

## Page Patterns

**Index page**: `useAtomValue(hasPermissionAtom)` → canCreate/canUpdate/canDelete; `useQuery` list; 300ms debounced search; TanStack Table; delete modal state.

**Form page** — split into outer + inner:
- *Outer* (`{Domain}FormPage`): `useParams` → `isEdit`; queries for detail + dependencies; guard renders (loading, not-found, edit-blocked); passes `initialValues` to inner
- *Inner* (`{Domain}Form`): `ModalStage` state machine; `useMutation` for create/update; `useForm` from `@tanstack/react-form` with Zod `safeParse`; `intentRef` for approval intent

## Import Paths

```ts
import { trpcClient } from '../../lib/trpc';       // adjust depth
import { hasPermissionAtom } from '../../lib/atoms';
import { useIntl } from 'react-intl';
import { Icon } from '@iconify/react';
```
