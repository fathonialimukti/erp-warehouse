---
name: client-core-packages
description: 'Install and configure React Router v7, TanStack Query v5, TanStack Table v8, HeroUI v3 beta, and tRPC client (TanStack React Query integration) in React 19 + Vite client apps. Use for new client bootstrap or package-stack upgrades based on latest docs.'
argument-hint: 'Client app path (or use current workspace)'
---

# Client Core Packages

## What This Skill Produces

A React 19 + Vite client with a modern baseline package stack and minimal wiring:

- Routing: `react-router`
- Server state: `@tanstack/react-query`
- Client/global state: `jotai`
- Data grids/tables: `@tanstack/react-table`
- UI system: `@heroui/react@beta` + `@heroui/styles@beta` (HeroUI v3 beta)
- Typed API client: `@trpc/client` + `@trpc/tanstack-react-query`

## When to Use

Use this skill when you need to:

- Bootstrap a new React client package foundation quickly
- Upgrade an existing client to current package conventions
- Standardize package decisions across team members
- Avoid stale snippets by following latest documentation links

## Procedure

1. Confirm app baseline and package manager
- Verify `package.json` exists and app is React 19 + Vite.
- This skill uses **Bun** as the package manager.

2. Install the core dependencies
```sh
bun add react-router @tanstack/react-query @tanstack/react-table jotai @trpc/client @trpc/tanstack-react-query @heroui/styles@beta @heroui/react@beta
```
- If the team is not ready for HeroUI v3 beta, use `@heroui/react` (no tag) instead.

3. Configure React Router
- Follow Declarative mode for SPA clients.
- Wrap app with `BrowserRouter` and import from `react-router`.

4. Configure TanStack Query
- Create one `QueryClient` and wrap app with `QueryClientProvider`.
- Keep defaults simple first; tune stale/cache behavior later.

5. Configure Jotai
- No provider needed by default; atoms are global singletons.
- Use `atom()` for lightweight client state that does not belong in the server cache.
- Use `atomWithStorage()` (from `jotai/utils`) for persisted atoms.
- Keep atoms colocated with the feature that owns them.

6. Configure tRPC client (preferred integration)
- Prefer `@trpc/tanstack-react-query` (latest recommended integration in tRPC v11 docs).
- Create tRPC client with `createTRPCClient` + `httpBatchLink`.
- Create `TRPCProvider`/helpers and connect to the same `QueryClient`.

7. Configure HeroUI v3 beta styles
- Ensure Tailwind CSS v4 is installed.
- In global CSS, import in this order:
```css
@import "tailwindcss";
@import "@heroui/styles";
```

8. Add TanStack Table where needed
- Use `@tanstack/react-table` only in data-heavy screens.
- Start with a small typed table wrapper and expand features gradually.

9. Validate setup
- Run `bun install`, typecheck/build, and app startup.
- Confirm providers are mounted once and in a consistent root composition.

## Decision Points

- State management split:
  - Server/async state → TanStack Query (`useQuery`, `useMutation`).
  - Lightweight client/UI state → Jotai atoms.
  - Do not put server data into Jotai atoms.
- tRPC integration:
  - Prefer: `@trpc/tanstack-react-query` for new setups.
  - Legacy compatibility only: `@trpc/react-query` (classic client).
- HeroUI channel:
  - Prefer: v3 beta (`@heroui/react@beta` + `@heroui/styles@beta`) for new projects.
  - Fallback: stable v2 (`@heroui/react`) if team avoids beta.
- Router mode:
  - Use Declarative mode for Vite SPA unless server/data-mode requirements are explicit.

## Completion Checks

A task is complete when all are true:

- `package.json` includes all selected dependencies including `jotai`.
- App root has `BrowserRouter` + `QueryClientProvider` + tRPC provider composition.
- HeroUI v3 path includes required CSS import order.
- A sample route renders, one sample query executes, and one Jotai atom is read/written.
- `bun run build` succeeds.

## References

- [Latest docs and package links](./references/latest-docs.md)
