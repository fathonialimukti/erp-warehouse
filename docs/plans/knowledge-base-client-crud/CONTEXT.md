# knowledge-base-client-crud

## Frozen Contract

### Domain
- **Source of truth:** `KnowledgeDocument` (DB)
- **Derived index:** existing `KnowledgeChunk` (`source` = document `slug`, no FK in v1)
- **RAG path:** unchanged — `lib/rag.ts` FTS on `knowledge_chunks` only
- **No runtime filesystem writes** to `src/knowledge/*.md` (disk = bootstrap/seed only)

### Prisma model `KnowledgeDocument` → `knowledge_documents`
| Field | Type | Notes |
|---|---|---|
| `id` | String ULID PK | `@default(ulid())` |
| `slug` | String unique | e.g. `general`, `approvals` |
| `title` | String | display name |
| `content` | String | full markdown body |
| `isActive` | Boolean default true | inactive → no chunks in RAG |
| `createdAt` / `updatedAt` | DateTime | standard |

### Zod (`packages/schemas/src/knowledge.ts`, export via package path `@repo/schemas/knowledge`)
- `knowledgeListInputSchema` — reuse `createListInputSchema()` from common
- `knowledgeIdSchema` — `{ id: z.string().min(1) }`
- `createKnowledgeDocumentSchema` — `{ slug, title, content, isActive? }`
  - `slug`: non-empty, prefer `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab)
  - `title`: min 1
  - `content`: string (empty allowed)
  - `isActive`: boolean optional default true
- `updateKnowledgeDocumentSchema` — partial of create fields + required `id`
- `reindexKnowledgeSchema` — `{ id: z.string().min(1).optional() }`
- Form schema can mirror create (client form validation)

### tRPC router `knowledge` (namespace: `trpcClient.knowledge.*`)
| Procedure | Permission | Input | Behavior |
|---|---|---|---|
| `list` | `knowledge@read` | list input | paginated; search title/slug; each row includes `chunkCount` |
| `getById` | `knowledge@read` | `{ id }` | doc + `chunkCount` |
| `create` | `knowledge@create` | create schema | create → re-chunk if active; duplicate slug → CONFLICT |
| `update` | `knowledge@update` | update schema | apply re-chunk rules; slug change moves chunk source |
| `delete` | `knowledge@delete` | `{ id }` | delete doc + chunks by slug |
| `reindex` | `knowledge@update` | `{ id? }` | one active doc or all active docs |

Mutations that touch doc+chunks: transactional.

### Re-chunk rules
Extract chunker from `scripts/ingest-knowledge.ts` → `lib/knowledge-ingest.ts` (heading split, 800 chars).
- create active → chunk under slug
- update content/slug + active → delete old source chunks as needed, re-chunk
- title-only update → no re-chunk required
- deactivate → delete chunks for slug
- activate → re-chunk
- delete → delete doc + chunks
- reindex id → if active, replace chunks; if inactive, ensure no chunks
- reindex no id → all active docs

### Permissions (seed `PERMISSIONS` only — System Admin already `*`)
```
knowledge@create — Create knowledge base documents
knowledge@read — Read knowledge base documents
knowledge@update — Update and reindex knowledge base documents
knowledge@delete — Delete knowledge base documents
```
- No ROLE_PERMISSIONS edits for System Admin
- Do not grant to Warehouse Manager / Operator / Approver in v1
- Do not fold into `ai_admin@access`
- Reindex uses `knowledge@update`

### Seed content bootstrap
- After ACLs: import `apps/server/src/knowledge/*.md` → upsert `KnowledgeDocument` by slug → re-chunk
- Idempotent by slug
- CLI `ai:ingest`: default reindex active DB docs; optional import-from-disk flag

### Client routes
| Path | Page |
|---|---|
| `/knowledge` | Index |
| `/knowledge/new` | Form create |
| `/knowledge/:id` | Detail |
| `/knowledge/:id/edit` | Form edit |

### Client UI behavior
- Index: search title/slug, pagination, columns title/slug/active/chunkCount/updatedAt; create/edit/delete permission-gated
- Detail: PageHeader back/edit/delete; meta + preformatted content; Reindex button (`knowledge@update`)
- Form: title, slug, content textarea, isActive; no approval flow; Zod via `@repo/schemas/knowledge`
- Nav: **Knowledge Base** near AI Admin; `permission: "knowledge@read"`
- Locales: `knowledge.*` in en.json + id.json
- tRPC: vanilla client + React Query only (`trpcClient.knowledge.*`)
- HeroUI only; no className on HeroUI components

### Response shapes (list/get)
```ts
{
  id: string
  slug: string
  title: string
  content: string  // list may omit content if desired; prefer include for simplicity OR omit on list for size — **omit content on list**, include on getById
  isActive: boolean
  chunkCount: number
  createdAt: string | Date
  updatedAt: string | Date
}
```
**List:** omit `content` (or return empty) to keep payload small. **getById:** full `content`.

### Locale key prefixes
- `knowledge.index.*`
- `knowledge.detail.*`
- `knowledge.form.*`
- `nav.knowledge` (sidebar label)

## Reference Files
- Backend patterns: `apps/server/src/routers/supplier.ts`, `apps/server/src/routers/CLAUDE.md`, `apps/server/src/lib/rag.ts`, `apps/server/src/scripts/ingest-knowledge.ts`, `apps/server/src/prisma/schema.prisma` (`KnowledgeChunk`), `apps/server/src/prisma/seed.ts` (PERMISSIONS near `ai_admin@access`), `apps/server/src/router.ts`
- Schema patterns: `packages/schemas/src/supplier.ts`, `packages/schemas/src/common.ts`
- Frontend patterns: `apps/client/src/pages/suppliers/SupplierIndexPage.tsx`, `SupplierDetailPage.tsx`, `SupplierFormPage.tsx`, `apps/client/src/routes.tsx` (ai-admin route), `apps/client/src/constants/nav-menu.ts` (ai-admin entry), `apps/client/src/assets/NavIcons.tsx`, locales `apps/client/src/locales/en.json` + `id.json`
- Design: `docs/superpowers/specs/2026-07-21-knowledge-base-client-crud-design.md`

## Sibling Awareness
- **Backend:** owns Prisma model + migration, schemas package, knowledge-ingest lib, router, seed permissions + markdown bootstrap, CLI ingest update. Exposes `knowledge.list|getById|create|update|delete|reindex`.
- **Frontend:** owns pages, routes, nav, icon, locales. Calls `trpcClient.knowledge.*`. Can implement against frozen contract even if backend lands same turn; fix types after backend wires router.
- **Neither:** change `rag.ts` retrieval algorithm; no chunk UI; no file upload.

## Do Not Re-derive
- Document-level CRUD only (not chunks)
- DB-only source of truth
- Approach A (full pages, not embedded in ai-admin)
- System Admin only via `*`
- Separate from `ai_admin@access`
- No approval workflow on knowledge forms
- No `documentId` FK on chunks in v1
- Deactivate deletes chunks
- Ponytail: fewest files, reuse supplier-like CRUD spine, extract chunker once
