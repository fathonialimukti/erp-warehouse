# Project bottom line (all agents)

Shared floor for every agent and chat. **Domain detail does not live here** — use the specialist agent + path instructions.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime / PM | **Bun** + Turborepo |
| Language | **TypeScript** strict (`exactOptionalPropertyTypes`) |
| Client | React 19 + Vite + Tauri · Tailwind v4 + **HeroUI v3** (`@heroui/react` 3.x, `@heroui/styles`) · react-intl v6 · @tanstack/{react-query,react-form,react-table} · jotai · framer-motion · @iconify/react |
| API | **tRPC v11+** end-to-end typesafe (vanilla client, `trpcClient` in `apps/client/src/lib/trpc.ts`) |
| Server | Express + Prisma (PostgreSQL, ULID ids) |
| Shared validation | `@repo/schemas` (Zod) |

## Who owns what

| Work | Agent | Path rules |
|------|--------|------------|
| UI / pages / client hooks | **frontend-engineer** | owns HeroUI v3 + react-intl conventions inline |
| Routers / Prisma / schemas | **backend-engineer** | owns tRPC/Prisma/Zod conventions inline |
| Schema + router + pages together | **full-stack-engineer** (orchestrates only) | delegates to specialists |
| Review / audit / ship rec | **code-reviewer** | read-only git; recommend commit only |

Do **not** stuff frontend UI law or Prisma patterns into this file — specialists own those.

## Code floor (everywhere)

- Match existing architecture; shortest **correct** wiring; no premature abstraction
- Prefer inference; avoid `any`; no bare `!` without a safety comment
- Arrow functions, early returns, self-documenting names; comments only when needed
- Respect recent edits; do not resurrect deleted code
- **Preserve established features** — never delete or disable existing behavior, routes, fields, or UI unless the user explicitly asks. Extend, don't replace
- Permission strings: always `resource@action` (never `resource_action`)
- **File edits:** create/update source only via edit tools (`write`, `edit`, `apply_patch`). **Never** write or overwrite product source (`.ts`, `.tsx`, `.js`, `.jsx`, `.json` locales, CSS, Prisma, configs) via shell (`cat`, heredoc, `Path().write_text()`, `echo >`, etc.). Shell is for running commands only (dev, build, test, typecheck, migrations, `ui-ux-pro-max` search).
- **Git:** manual only for every agent **except `full-stack-engineer`**, and only **after explicit user confirmation** — it may run `add` / `commit` / `push` / branch / PR actions, one confirmed action at a time (each gated by `ask` in `opencode.json`). All other agents: no `add` / `commit` / `push` / merge / PR unless the user runs it (enforced by the permission denies in `opencode.json`)

**UI work is not "shortest class list."** If you touch client UI, frontend-engineer owns UI craft (HeroUI v3 + tokens in `index.css` + matching existing pages) — craft > flat minimal shells.

## Monorepo map

```
apps/client/                 React client (Tailwind v4 + HeroUI v3)
apps/server/                 Express + tRPC + Prisma (port 10022)
packages/schemas/            Shared Zod (@repo/schemas)
.agents/skills/              Canonical skills (auto-discovered by opencode)
.opencode/agent/             Specialist agents
.opencode/plugin/            Hooks (e.g. impeccable post-edit check)
opencode.json                MCP servers + permissions
AGENTS.md                    This bottom line
```

Do **not** recreate `.claude/skills/` or duplicate skill mirrors for other agents.

## Commands (shared)

| Scope | Command |
|-------|---------|
| Dev / build / types | `bun run dev` · `bun run build` · `bun run check-types` |
| DB (server pkg) | `bun run db:migrate` · `db:seed` · `db:studio` · `db:push` |
| Tests | `bun run test` · `bunx vitest run <path>` |

## Skills layout

- Real skills: `.agents/skills/` only
- Domain module notes (when present): `apps/server/src/routers/*/CLAUDE.md`
- Never invent a second design system or second agent tree

When in doubt: **simplest solution that matches architecture**, and for UI, **do not ship unfinished gray shells**.
