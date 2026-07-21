# Knowledge Base Client CRUD (RAG Control) — Design

**Date:** 2026-07-21  
**Status:** Approved for planning  
**Approach:** A — Minimal admin CRUD (document-level, DB source of truth)

## Problem

RAG knowledge today is:

- 10 markdown files under `apps/server/src/knowledge/`
- Ingested only via CLI (`bun run ai:ingest` / `ingest-knowledge.ts`)
- Stored as derived rows in `knowledge_chunks`
- Retrieved at chat time via PostgreSQL FTS in `lib/rag.ts`

There is **no client UI** to list, create, edit, delete, or reindex knowledge. `/ai-admin` is an SQL admin chat, not a knowledge manager. Admins cannot control RAG without server filesystem access and a redeploy/CLI run.

## Goals

- Let authorized users manage RAG knowledge from the client
- Document-level CRUD (not chunk-level editing)
- DB as runtime source of truth; chunks remain a derived FTS index
- Re-chunk on save so AI chat reflects changes without CLI/redeploy

## Non-goals (v1)

- Chunk inspector / direct chunk edit UI
- File upload of `.md` from the browser
- Version history / optimistic locking
- Live “test retrieval” playground
- Vector/embedding search upgrade
- Embedding knowledge management inside `/ai-admin` only

## Architecture

```
Client (Index / Detail / Form)
        │ tRPC knowledge.*
        ▼
KnowledgeDocument (source of truth)
        │ on create/update/activate/reindex
        ▼
splitIntoChunks() → KnowledgeChunk rows (FTS index)
        │
        ▼
retrieveRelevantChunks()  [unchanged query path]
```

- Runtime knowledge **does not** write to `src/knowledge/*.md`
- Existing markdown files become **bootstrap/seed input only**
- CLI `ai:ingest` reindexes active DB documents (optional disk-import flag for bootstrap)

## Data model

### New: `KnowledgeDocument`

| Field | Type | Notes |
|---|---|---|
| `id` | ULID | PK |
| `slug` | string, unique | stable key, e.g. `general`, `approvals` |
| `title` | string | display name |
| `content` | text | full markdown body |
| `isActive` | boolean, default true | inactive docs excluded from RAG |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Prisma map: `knowledge_documents`.

### Existing: `KnowledgeChunk` (unchanged shape)

| Field | Role |
|---|---|
| `id` | ULID |
| `source` | document `slug` (join key for v1; no FK) |
| `title` | chunk title |
| `content` | chunk body |
| `createdAt` / `updatedAt` | |

**v1 decision:** no `documentId` FK. Slug join is enough; add FK later only if needed.

## Re-chunk rules

Extract current chunker from `scripts/ingest-knowledge.ts` into `lib/knowledge-ingest.ts` (heading split, max 800 chars, paragraph fallback).

| Event | Behavior |
|---|---|
| create | insert document → chunk under `source = slug` |
| update content/slug/active→true | delete chunks for old/new source as needed → re-chunk if active |
| update title only | no re-chunk required (optional no-op reindex) |
| deactivate (`isActive=false`) | delete that document’s chunks (RAG must not hit stale content) |
| activate | re-chunk from current content |
| delete | delete document + chunks where `source = slug` |
| reindex (one or all active) | re-chunk without requiring content edit |

Slug change: delete chunks for previous slug, write chunks under new slug.

## API (tRPC `knowledge`)

| Procedure | Permission | Behavior |
|---|---|---|
| `list` | `knowledge@read` | paginated; search title/slug; include chunk count |
| `getById` | `knowledge@read` | one doc + chunk count |
| `create` | `knowledge@create` | create → re-chunk if active |
| `update` | `knowledge@update` | update → re-chunk rules above |
| `delete` | `knowledge@delete` | delete doc + chunks |
| `reindex` | `knowledge@update` | input `{ id?: string }` — if `id` set, re-chunk that doc (must be active or no-op after activate rules); if omitted, re-chunk **all active** docs |

- All procedures: `protectedProcedure` + `hasPermission('knowledge@…')`
- Prefer `transactionalProtectedProcedure` (or equivalent) for create/update/delete/reindex so doc + chunks stay consistent
- Zod schemas in `@repo/schemas` (not local-only)
- Duplicate slug → `CONFLICT`
- Empty content allowed → 0 chunks

### Permissions (seed) — required `seed.ts` changes

Add to `PERMISSIONS` array in `apps/server/src/prisma/seed.ts` (same shape as existing entries, near AI admin):

```ts
// Knowledge Base (RAG documents)
{ name: "knowledge@create", description: "Create knowledge base documents" },
{ name: "knowledge@read", description: "Read knowledge base documents" },
{ name: "knowledge@update", description: "Update and reindex knowledge base documents" },
{ name: "knowledge@delete", description: "Delete knowledge base documents" },
```

**Role grants (`ROLE_PERMISSIONS`):**

| Role | Grant | Why |
|---|---|---|
| `System Admin` | already `["*"]` | Gets all four automatically — **no ROLE_PERMISSIONS edit required** |
| `Warehouse Manager` | **none in v1** | Knowledge is AI/admin config, not warehouse ops |
| `Warehouse Operator` | **none** | |
| `Approver` | **none** | |

Do **not** fold knowledge into `ai_admin@access`. Keep separate so RAG content admin ≠ full SQL admin.

**Nav / client:** show Knowledge Base when `hasPermission('knowledge@read')` (same pattern as other resources).

**No new permission for reindex** — reuse `knowledge@update`.

## Client UI

### Routes

| Route | Page |
|---|---|
| `/knowledge` | Index |
| `/knowledge/new` | Form create |
| `/knowledge/:id` | Detail |
| `/knowledge/:id/edit` | Form edit |

Follow existing Index / Detail / Form templates (vanilla tRPC client + React Query, HeroUI, permission gates, `react-intl`).

### Index

- Debounced search (title/slug), pagination
- Columns: title, slug, active badge, chunk count, updatedAt
- Create button if `knowledge@create`
- Row navigate to detail; edit/delete gated by permissions
- No “reindex all” on index in v1

### Detail

- `PageHeader`: back, edit, delete (permission-gated)
- Meta: slug, active, updatedAt, chunk count
- Content: plain monospace / preformatted block (no new markdown renderer unless already present)
- **Reindex** button if `knowledge@update`

### Form

- Fields: `title`, `slug`, `content` (textarea), `isActive`
- Slug editable on edit (changing slug reassigns chunk `source`)
- No DRAFT/PROPOSED approval flow — admin config, not a warehouse transaction
- Zod validation via shared schemas
- On success: invalidate queries, navigate to detail

### Nav & i18n

- Sidebar item **Knowledge Base** near AI Admin
- Permission to show nav: `knowledge@read`
- Register icon in `NavIcons` + `nav-menu.ts`
- Locale keys under `knowledge.*` in `en.json` and `id.json`

## Bootstrap / migration / seeder

### Prisma
1. Migration: add `KnowledgeDocument` → table `knowledge_documents`

### `seed.ts` (access control)
2. Append the four `knowledge@*` rows to `PERMISSIONS` (see above)
3. **No** `ROLE_PERMISSIONS` change for System Admin (`*` already covers them)
4. Do not grant `knowledge@*` to Warehouse Manager / Operator / Approver in v1

### `seed.ts` (knowledge content bootstrap)
5. After permissions/roles (or in a dedicated seed step), import existing markdown once:
   - Read `apps/server/src/knowledge/*.md` (or call shared import helper)
   - Upsert `KnowledgeDocument` per file:
     - `slug` = filename without `.md`
     - `title` = first H1 or humanized slug
     - `content` = file body
     - `isActive` = true
   - Re-chunk each active doc into `knowledge_chunks` via shared `knowledge-ingest` helper
6. Prefer **idempotent upsert by slug** so re-running seed does not duplicate documents (update content from disk on seed is OK for bootstrap; runtime edits live in DB after that)

### CLI
7. Update `scripts/ingest-knowledge.ts`:
   - default: reindex all **active DB** documents
   - optional flag: import-from-disk for bootstrap only (same path as seed import)

### Order on fresh DB
`migrate` → `seed` (permissions + roles + users + knowledge docs/chunks) → app ready; AI RAG works without a separate manual ingest if seed ran the bootstrap import.

## Edge cases

| Case | Behavior |
|---|---|
| Duplicate slug | `CONFLICT` |
| Empty content | save OK; 0 chunks |
| Slug rename | move chunk `source` old → new |
| Deactivate | delete chunks |
| Activate | re-chunk |
| Concurrent edits | last-write-wins (no locking v1) |
| RAG path | unchanged FTS on `knowledge_chunks` only |

## Security

- Permission format always `resource@action` (`knowledge@read`, etc.)
- No client-supplied SQL
- Content stored as plain text
- Activity logging: follow existing simple-CRUD admin pattern if present; do not invent a new logging subsystem for v1

## Testing (minimal)

- Unit: chunker / re-chunk helper (split + replace by source)
- Integration/router: create → chunks exist; update content → chunks change; delete → chunks gone; deactivate → no chunks; activate → chunks return
- Client e2e: optional; only if list-spine tests are trivial to extend

## File touch map (implementation)

| Area | Paths |
|---|---|
| Schemas | `packages/schemas/src/` knowledge schemas + barrel export |
| Prisma | `apps/server/src/prisma/schema.prisma`, migration, seed |
| Server lib | `apps/server/src/lib/knowledge-ingest.ts`, update `scripts/ingest-knowledge.ts` |
| Server API | `apps/server/src/routers/knowledge.ts`, wire in `router.ts` |
| Client pages | `apps/client/src/pages/knowledge/*` |
| Client shell | `routes.tsx`, `nav-menu.ts`, `NavIcons`, locales |

## Success criteria

An admin with `knowledge@*` can list, create, edit, deactivate, reindex, and delete knowledge documents in the client. After save, AI chat RAG retrieval uses the updated chunks without CLI or redeploy.

## Open decisions closed in design

| Decision | Choice |
|---|---|
| Control level | Full knowledge CRUD |
| Edit unit | Documents |
| Source of truth | DB-only documents |
| Approach | Minimal admin CRUD (A) |
| Chunk FK | Skip in v1 (slug join) |
| Inactive docs | Delete chunks on deactivate |
