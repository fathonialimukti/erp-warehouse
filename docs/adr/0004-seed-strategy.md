# ADR 0004: Deterministic Global Seeder

- **Status:** Accepted
- **Date:** 2026-08-16 (shipped in `ad4fb44`, `c1813ce`, `2823275`)
- **Scope:** `apps/server/src/prisma/seed.ts`, `apps/server/src/prisma/seed/tests/`

## Context

The ERP Warehouse needs realistic demo data for:
- **Development** — developers need a populated database to work against
- **E2E tests** — tests need baseline data (warehouses, SKUs, suppliers, users)
- **Demo/landing** — the public landing page shows screenshots of populated
  views

Early seeding used `@faker-js/faker` for random data. This caused:
- **Non-deterministic output** — every `db:seed` produced different data,
  breaking screenshot comparisons and making bugs hard to reproduce
- **Unstable test data** — E2E tests that depend on seeded data would fail
  when the random seed changed
- **No invariant guarantees** — faker doesn't know about business rules
  (container check digits, demand plan invariants, SoD separation)

## Decision

**Deterministic global seeder with explicit data catalog and invariant helpers.**

### Design

1. **Data catalog** (`seed-catalog.ts`): explicit list of products, SKUs,
   suppliers, warehouses — not random. Each entry has stable IDs and
   realistic attributes (container numbers with valid ISO 6346 check digits,
   supplier codes, warehouse locations).

2. **RNG scaffolding** (`seed-rng.ts`): seeded pseudo-random number
   generator so the same seed always produces the same data. The seed is
   fixed in the script — changing it requires an explicit edit.

3. **Invariant helpers** (`seed-invariants.ts`): business-rule-aware
   helpers that enforce:
   - **ISO 6346 check digit** — container numbers are always valid
   - **SoD (Separation of Duties)** — no user has both approve and execute
     permissions for the same transaction type
   - **Demand plan invariants** — inbound volumes don't exceed warehouse
     capacity
   - **Interleaved months** — transactions are spread across the seeded
     period so inbound drains within capacity

4. **Step-based execution** (`seed-steps.ts`): ordered steps — access,
   master data, receiving, internal, balances — each idempotent and
   independently runnable.

5. **Test coverage** (`seed/tests/`): vitest tests verify the seeder
   produces valid data (ISO 6346, invariants, RNG determinism).

### Seeded data

| Entity | Count | Notes |
|---|---|---|
| Users | 10 | 10-role SoD matrix (admin, manager, supervisor, clerks, auditor) |
| Roles | 10 | Each with explicit `resource@action` permission set |
| Warehouses | 3 | With storage locations and pallet positions |
| Products | 12 | Raw materials, packaging, finished goods |
| SKUs | 24 | 2 per product (raw + finished) |
| Suppliers | 8 | With contact info, lead times, MOQs |
| Transactions | ~180 | Spread across 3 months, interleaved by type |

## Ruled-out alternatives

1. **Faker-only (original approach).** Rejected: non-deterministic, no
   invariant guarantees, screenshot comparisons break, E2E tests flake.

2. **Manual data entry.** Rejected: doesn't scale, error-prone, can't be
   re-run idempotently.

3. **External test data fixtures (JSON files).** Rejected: doesn't enforce
   invariants, hard to maintain across schema changes, doesn't exercise
   the seed code path.

4. **No seed data.** Rejected: developers can't work without baseline data,
   E2E tests can't run, landing screenshots are empty.

## Consequences

- **Positive:**
  - Deterministic — same seed always produces the same data
  - Invariant-aware — business rules enforced at seed time, not discovered
    later
  - Testable — seed output is covered by vitest tests
  - Idempotent — `db:seed` can be re-run safely
  - E2E-ready — baseline data is stable across runs

- **Trade-offs:**
  - Seed script is larger (~500 lines across multiple files)
  - Adding a new entity requires updating the catalog + invariants + tests
  - Fixed seed means data looks synthetic (not random) — acceptable for
    dev/test, less ideal for investor demos

## Verification

- `bunx vitest run seed` — ISO 6346, invariants, RNG determinism
- `bun run --cwd apps/server db:all` — full reset + seed + backfill
- E2E: `apps/client/src/tests/e2e/helpers/seed.ts` — idempotent baseline
