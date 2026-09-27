# Server — Express + tRPC + Prisma

The API layer of the ERP Warehouse system. Exposes a type-safe tRPC API over
Express 5, backed by PostgreSQL via Prisma 7.

## Tech

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Framework | Express 5 + tRPC v11 |
| ORM | Prisma 7 + PostgreSQL (ULID keys) |
| Validation | Zod v4 (`@repo/schemas`) |
| Logging | pino + DB system logs |
| Process | PM2 (production) |

## Architecture

```
Client (React / Tauri)
    │  tRPC over HTTP (trpcClient)
    ▼
Express 5 server  ──  middleware (auth, CSRF, rate limit, helmet, XSS)
    │
    ├── tRPC routers (35+ domains)
    │       └── procedures (list / detail / create / update / delete)
    │
    └── Prisma 7 → PostgreSQL
```

## Routers

Routers live in `src/routers/` — one file per domain. Each router exposes
`list`, `detail`, `create`, `update`, `delete` procedures gated by
`resource@action` permissions. See `src/router.ts` for the registry.

| Domain | File | Permissions |
|---|---|---|
| Receiving | `receiving.ts` | `receiving@*` |
| Shipment | `shipment.ts` | `shipment@*` |
| Putaway | `putaway.ts` | `putaway@*` |
| Picking | `pick.ts` | `pick@*` |
| WIP | `wip-completion.ts`, `wip-issue.ts` | `wip@*` |
| Returns | `return-to-supplier.ts`, `rma-receipt.ts` | `return@*` |
| Disposal / Loss / Found | `disposal.ts`, `loss.ts`, `found.ts` | `disposal@*`, `loss@*`, `found@*` |
| Transfer | `subinventory-transfer.ts` | `transfer@*` |
| Purchases | `purchase-order.ts` | `purchase@*` |
| Inventory | `sku.ts`, `product.ts`, `warehouse.ts`, `pallet.ts`, `supplier.ts` | `sku@*`, `product@*`, etc. |
| Users / Roles | `user.ts`, `role.ts` | `user@*`, `role@*` |
| AI | `ai.ts`, `ai-analytics.ts`, `ai-reorder.ts`, `ai-draft.ts` | `ai@*` |
| System | `settings.ts`, `logs.ts`, `notifications.ts` | `system@*` |
| Knowledge | `knowledge.ts` | `knowledge@*` |
| Landing | `landing.ts` | public |

## Commands

```sh
# Dev
bun run dev                  # watch mode on port 10022

# Build
bun run build                # prisma generate + tsc → dist/

# Database
bun run db:generate          # prisma generate
bun run db:push              # prisma db push (dev only)
bun run db:migrate           # prisma migrate dev
bun run db:migrate:deploy    # prisma migrate deploy (production-safe)
bun run db:seed              # reset + seed (dev only, guarded)
bun run db:all               # generate + reset + seed + backfill
bun run db:studio            # Prisma Studio

# AI
bun run ai:ingest            # ingest knowledge docs into chunks
bun run ai:embed             # generate embeddings for pending chunks

# Tests
bun run test                 # vitest (all tests)
```

## Environment

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
Optional: `SMTP_*`, `AI_*`, `APP_URL`, `LOG_LEVEL`, rate-limit/security settings.

## Conventions

- Permissions: `resource@action` (never `resource_action`)
- Zod schemas live in `packages/schemas` — shared by routers and client forms
- Conventional Commits; `bun run check-types` + `bun run lint` must pass
- Extend, don't replace — never delete existing behavior, routes, or fields
