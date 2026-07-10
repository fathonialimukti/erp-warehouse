# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (runs server + client in parallel via turborepo)
bun run dev

# Build all packages and apps
bun run build

# Lint all packages and apps
bun run lint

# Type-check everything
bun run check-types

# Alternative: type-check all three workspaces
bun run tsc

# Format with Prettier
bun run format
```

### Server (`apps/server`)

```bash
cd apps/server

# Start dev server (also launches Prisma Studio + AI DevTools)
bun run dev

# Type-check only
bun run check-types

# Run tests (vitest)
bun run test

# Generate Prisma client (needed after schema changes)
bun run db:generate

# Push schema to DB (no migrations)
bun run db:push

# Run migrations
bun run db:migrate

# Open Prisma Studio
bun run db:studio

# Reset DB, seed data, and ingest knowledge
bun run db:seed

# Ingest markdown knowledge files into DB for RAG
bun run ai:ingest
```

### Client (`apps/client`)

```bash
cd apps/client
bun run dev          # Vite dev server (+ Tauri in dev mode)
bun run build        # tsc + vite build
bun run check-types  # Type-check only
bun run lint
bun run preview      # Vite preview
```

## Architecture

### Monorepo Structure (Bun + Turborepo)

- **Package manager:** Bun (locked to 1.3.4)
- **Build orchestration:** Turborepo (`turbo.json`)
- **Workspaces:** `apps/*` and `packages/*`

| Workspace | Description |
|---|---|
| `apps/server` | Express 5 + tRPC backend with Prisma ORM |
| `apps/client` | React 19 SPA (Vite) with Tauri v2 desktop shell |
| `packages/schemas` | Shared Zod schemas (`@repo/schemas`) |
| `packages/ui` | Shared React components (`@repo/ui`) |
| `packages/eslint-config` | Shared ESLint configs |
| `packages/typescript-config` | Shared `tsconfig.json` presets |

### Server Architecture

**Runtime:** Bun with Express 5. The entry point is [apps/server/src/index.ts](apps/server/src/index.ts).

**API layer:** tRPC v11, registered at `/trpc`. All business logic lives in routers under `src/routers/`. The root router is in [apps/server/src/router.ts](apps/server/src/router.ts).

**Auth:** Cookie-based JWT (`access_token`). Decoded in [apps/server/src/context.ts](apps/server/src/context.ts) and exposed via tRPC context. Middleware chain in [apps/server/src/trpc.ts](apps/server/src/trpc.ts):
- `publicProcedure` — no auth required
- `protectedProcedure` — requires valid JWT (`isAuthed` middleware)
- `protectedProcedure.use(hasPermission(...))` — requires specific permission
- `transactionalProtectedProcedure` — authed + wrapped in Prisma `$transaction`

**Permission model:** RBAC — `User → Role → RoleHasPermission → Permission`. Permission names follow `resource@action` format (e.g., `receiving@approve`, `warehouse@create`).

**Database:** PostgreSQL via Prisma ORM. Schema is in [apps/server/src/prisma/schema.prisma](apps/server/src/prisma/schema.prisma). The `prisma` client singleton is in [apps/server/src/lib/prisma.ts](apps/server/src/lib/prisma.ts).

### Domain Model — Warehouse Transactions

All 10 transaction types follow Oracle naming (abbreviation in comments):

**Inbound (IN):** RECEIVING (GR), WIP_COMPLETION (FGR), RMA_RECEIPT (CRR), FOUND (FO)
**Outbound (OUT):** WIP_ISSUE (MI), SHIPMENT (DO), RETURN_TO_SUPPLIER (SR), DISPOSAL (DS), LOSS (LO)
**Internal:** SUBINVENTORY_TRANSFER (TO)

Every transaction goes through: **DRAFT → PROPOSED → APPROVED (or REJECTED)**.

The **Pallet** is the atomic inventory unit. When an IN transaction is APPROVED:
1. Pallet records are created (one per quantity unit, with polymorphic `sourceType`/`sourceItemId`)
2. PutawayLine records are created (one per pallet, tracking where it goes)

When an OUT transaction is APPROVED:
1. Available pallets are reserved (FIFO by `createdAt`) and marked NOT_AVAILABLE
2. PickLine records are created (one per pallet)

**StockMovement** is an immutable audit log. It is written **only when ALL PutawayLines or PickLines for a document are COMPLETED**, not on approval. This is handled by `writeStockMovementsFromDocument()` in [apps/server/src/lib/transaction.ts](apps/server/src/lib/transaction.ts). `SkuInventoryBalance` (monthly snapshot) is upserted at the same time.

Every transaction item follows the same shape: `{ skuId, palletTypeId, quantity }`. Shared helpers live in [apps/server/src/lib/transaction.ts](apps/server/src/lib/transaction.ts).

### AI Assistant

Built on Vercel AI SDK v6 (`ai` package). Two-layer architecture:

- **Server** (`POST /api/ai/chat` in [apps/server/src/routes/ai.ts](apps/server/src/routes/ai.ts)): Authenticates, runs RAG (PostgreSQL full-text search on `knowledge_chunks`), builds system prompt with user role/permissions, streams response via SSE.
- **Client** (`AiAssistant.tsx` component): Receives SSE, executes client-side tools (`navigateTo`, `fillFormFields`, `getPageContext`). Uses a patched fetch to inject `tool-input-available` events for local models that emit `finishReason: "other"` instead of `"tool-calls"`.

**RAG:** Text-based (not vector). Markdown files in `src/knowledge/` are chunked by heading and ingested into `knowledge_chunks` table. Retrieval uses PostgreSQL `ts_rank` over a GIN index. Ingestion script: `bun run ai:ingest` or `bun src/scripts/ingest-knowledge.ts`.

### Client Architecture

**Stack:** React 19, React Router 7, Vite, Tailwind CSS v4, HeroUI (`@heroui/react`), Tauri v2.

**State management:** jotai (global atoms in [apps/client/src/lib/atoms.ts](apps/client/src/lib/atoms.ts)) + zustand for specialized stores. Server state via `@tanstack/react-query`.

**tRPC client:** Vanilla tRPC client (not React Query wrapper) in [apps/client/src/lib/trpc.ts](apps/client/src/lib/trpc.ts). Direct procedure calls: `trpcClient.auth.me.query()`, `trpcClient.auth.login.mutate(...)`.

**Auth flow:** On app mount, `useAuthBootstrap()` calls `auth.me` to validate the cookie. Auth state stored in jotai atoms (`authUserAtom`, `authTokenAtom`). `ProtectedRoute` wrapper guards all authenticated routes.

**Routing:** [apps/client/src/routes.tsx](apps/client/src/routes.tsx) — `PublicLayout` for `/login`, `PrivateLayout` (with sidebar + navbar) for everything else.

**i18n:** `react-intl` on the client (messages in `src/locales/en.json`, `id.json`). Server uses custom `getMessage()` with locale from `app-locale` cookie.

**3D Warehouse Layout:** `pages/warehouse/warehouse-layout-3d/` — three.js + `@react-three/fiber` for rendering warehouse models with GLB assets.

**File uploads:** Custom Express middleware serves `/uploads/`. Client uses `EntityPhoto` component for photo display and `ImageUploadField` for uploads.

### Shared Schemas (`packages/schemas`)

Zod schemas re-exported as `@repo/schemas/*`. Used by both client (form validation) and server (input validation). Exports match Prisma models and enums.

## Environment Variables

Set in `apps/server/.env` and declared in `turbo.json`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (default: `your-secret-key-change-this`) |
| `CORS_ORIGIN` | Allowed CORS origin |
| `PORT` | Express port (default: 2022) |
| `DB_POOL_MAX` | Prisma connection pool max (default: 10) |

## Module-Level Documentation

This repo uses per-module `CLAUDE.md` files for feature-specific deep dives. When working on a feature, read the local `CLAUDE.md` in the directory you're editing:

```text
apps/server/src/routers/CLAUDE.md              ← router patterns (procedure conventions)
apps/server/src/routers/receiving-transaction/CLAUDE.md  ← full data flow for receiving
```

The root `CLAUDE.md` (this file) covers the architecture; module `CLAUDE.md` files cover:
- Which files (server + client + schemas) define that feature
- The data flow from form → server → DB → response
- Business rules, edge cases, and gotchas specific to that module
- Related modules that this feature touches

Create a module-level `CLAUDE.md` for any feature you deeply document.

## Key Patterns

- **Error handling:** Throw `TRPCError` with `getMessage(ctx.locale, 'key')` for i18n error messages. Message keys are defined in [apps/server/src/lib/locale.ts](apps/server/src/lib/locale.ts).
- **Transactions:** Use `transactionalProtectedProcedure` or the `transactional` middleware when a mutation needs atomic DB operations.
- **Document numbers:** Use the `documentNumberRouter.generate` procedure with the appropriate prefix (see [apps/server/src/lib/document-number.ts](apps/server/src/lib/document-number.ts)).
- **Approval history:** Stored as `Json` field on each transaction table. Built via `buildApprovalActionData()` helper.
- **File uploads:** Use `uploadService.upload()` and `uploadService.remove()` from [apps/server/src/lib/upload-service.ts](apps/server/src/lib/upload-service.ts).