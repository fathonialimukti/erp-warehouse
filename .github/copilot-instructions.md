# Project bottom line (all agents)

Shared floor for every agent and chat. **Domain detail does not live here** — use the specialist agent + path instructions.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime / PM | **Bun** + Turborepo |
| Language | **TypeScript** strict (`exactOptionalPropertyTypes`) |
| Client | React 19 + Vite + Tauri · Tailwind v4 + **HeroUI v3** (`@heroui/react`) |
| API | **tRPC v11+** end-to-end typesafe |
| Server | Express + Prisma (PostgreSQL, ULID ids) |
| Shared validation | `@repo/schemas/<file>` (Zod, no barrel `index.ts`) |

## Who owns what

| Work | Agent | Path rules |
|------|--------|------------|
| UI / pages / client hooks | **Frontend Engineer** | `.github/instructions/client-frontend.instructions.md`, `i18n-locale.instructions.md` |
| Routers / Prisma / schemas | **Backend Engineer** | `prisma-server.instructions.md`, `schemas.instructions.md` |
| Schema + router + pages together | **Full-Stack Engineer** (orchestrates only) | delegates to specialists |
| Review / audit / ship rec | **Code Reviewer** | read-only git; recommend commit only |

Do **not** stuff frontend UI law or Prisma patterns into this file — specialists own those.

## Code floor (everywhere)

- Match existing architecture; shortest **correct** wiring; no premature abstraction
- Prefer inference; avoid `any`; no bare `!` without a safety comment
- Arrow functions, early returns, self-documenting names; comments only when needed
- Respect recent edits; do not resurrect deleted code
- Permission strings: always `resource@action` (never `resource_action` in new code)
- **File edits:** create/update source only via VS Code edit tools (`create_file`, `replace_string_in_file`, multi-edit). **Never** write or overwrite product source (`.ts`, `.tsx`, `.js`, `.jsx`, `.json` locales, CSS, Prisma, configs) via shell/Python (`cat`, heredoc, `Path().write_text()`, `echo >`, etc.). Shell is for running commands only (dev, build, test, typecheck, migrations).
- **Git:** manual only — no `add` / `commit` / `push` / merge / PR unless the user runs it

**UI work is not “shortest class list.”** If you touch client UI, Frontend Engineer + HeroUI v3 + existing polished pages apply — craft > flat unfinished shells.

## Monorepo map

```
apps/client/                 React client (Tailwind v4 + HeroUI v3)
apps/server/                 Express + tRPC + Prisma (port 10022)
packages/schemas/            Shared Zod (@repo/schemas/<file>)
.agents/skills/              Canonical skills only
.github/agents/              Specialist agents
.github/instructions/        Path-scoped rules (applyTo)
.github/copilot-instructions.md  This bottom line
docs/plans/                  Full-Stack context packs (CONTEXT.md)
```

Do **not** recreate `.claude/skills/` or `agent/skills/` mirrors for Copilot.

## Commands (shared)

| Scope | Command |
|-------|---------|
| Dev / build / types | `bun run dev` · `bun run build` · `bun run check-types` |
| DB (server pkg) | `bun run db:migrate` · `db:seed` · `db:studio` · `db:push` |
| Tests | `bun run test` · `bunx vitest run <path>` (server) |

## Skills layout

- Real skills: `.agents/skills/` only
- UI stack skill: `heroui-react` (not shadcn / not ui-ux-pro-max)
- Domain module notes (when present): `apps/server/src/routers/*/CLAUDE.md`
- Never invent a second design system or second agent tree

## Reference scaffolds (this repo)

| Layer | Path |
|-------|------|
| Router | `apps/server/src/routers/product.ts` or `knowledge.ts` |
| Schema | `packages/schemas/src/product.ts` → import `@repo/schemas/product` |
| Pages | `apps/client/src/pages/products/Product{Index,Detail,Form}Page.tsx` |
| Tokens | `apps/client/src/index.css` (HeroUI OKLCH theme) |

When in doubt: **simplest solution that matches architecture**, and for UI, **do not ship unfinished gray shells**.
