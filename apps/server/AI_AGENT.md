# ERP AI Agent

Architecture and implementation reference for the AI assistant integrated into the ERP Warehouse system.

---

## Overview

The AI assistant is built on **Vercel AI SDK v6** (`ai` package), running against a local OpenAI-compatible model. It operates across two layers:

- **Server** (`POST /api/ai/chat`) — authenticates the request, builds the system prompt with user context and RAG-retrieved knowledge, then streams the model response (including tool calls) back to the client as Server-Sent Events.
- **Client** (`AiAssistant.tsx`) — receives the SSE stream, executes tool calls (navigation, form fill, page context read), and renders the chat UI.

---

## High-Level Architecture

```
User Message
    │
    ▼
POST /api/ai/chat
    │
    ├── 1. Auth (JWT cookie or Bearer header)
    ├── 2. RAG  → retrieveRelevantChunks(userText)
    │              └── PostgreSQL FTS on knowledge_chunks
    ├── 3. User context (name, role, permissions from DB)
    ├── 4. buildSystemPrompt(user, permissions, ragContext)
    └── 5. streamText() + createUIMessageStream()
                │
                ▼ SSE stream (tool-input-start / delta / finish-step)
                │
        createPatchedFetch() [browser, intercepts SSE]
                │
                └── inject synthetic tool-input-available event
                            │
                            ▼
                    useChat (AI SDK React)
                            │
                            ├── onToolCall → runTool()
                            └── useEffect fallback → runTool()
```

---

## RAG Pipeline

> **Storage engine:** PostgreSQL full-text search (GIN index on `knowledge_chunks`).
> This is **text-based retrieval**, not vector/embedding search. There is no pgvector or embedding model involved.

### Knowledge Ingestion

**Script:** `src/scripts/ingest-knowledge.ts`
**Trigger:** `bun src/scripts/ingest-knowledge.ts` (also called by `bun run db:seed`)

```
src/knowledge/*.md
        │
        ▼ readdir + readFile
        │
        ▼ splitIntoChunks()
        │   ├── Split on markdown headings (##, ###)
        │   ├── Max chunk size: 800 characters
        │   └── Large sections split further by paragraph (\n\n)
        │
        ▼ prisma.knowledgeChunk.deleteMany()   ← full re-ingest
        │
        ▼ prisma.knowledgeChunk.createMany()
        │   Fields: id (ULID), source (filename), title, content, createdAt, updatedAt
        │
        ▼ CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
              USING GIN (to_tsvector('english', title || ' ' || content))
```

### Retrieval at Query Time

**File:** `src/lib/rag.ts`

```sql
SELECT title, content
FROM knowledge_chunks
WHERE to_tsvector('english', title || ' ' || content)
   @@ plainto_tsquery('english', :query)
ORDER BY ts_rank(
    to_tsvector('english', title || ' ' || content),
    plainto_tsquery('english', :query)
) DESC
LIMIT 5
```

- If the user message is empty, retrieval is skipped entirely.
- Up to 5 ranked chunks are returned and injected into the system prompt under a `## Retrieved Knowledge` section.
- Ranking is purely by `ts_rank` (term frequency in the document).

### Knowledge Base Files

Located in `src/knowledge/`:

| File | Contents |
|---|---|
| `pages.md` | Page list, route catalog, and AI usage guidance |
| `forms.md` | Field names per form for `fillFormFields` guidance |
| `navigation.md` | Navigation structure and menu layout |
| `permissions.md` | Permission format (`resource@action`) and full permission list |
| `approvals.md` | Approval workflow (DRAFT → PROPOSED → APPROVED/REJECTED) |
| `general.md` | General ERP system information |

### Upgrading to Vector Search (Future)

The current FTS approach works well for keyword-heavy ERP queries. To upgrade to semantic/vector search:

1. Add `pgvector` extension to PostgreSQL.
2. Add an `embedding vector(1536)` column to `knowledge_chunks`.
3. In `ingest-knowledge.ts`, call an embedding model (e.g. `text-embedding-3-small`) per chunk and store the result.
4. In `rag.ts`, embed the user query and switch to `ORDER BY embedding <=> query_vec LIMIT 5`.
5. Add an `ivfflat` or `hnsw` index for performance.

---

## Server Components

### `src/routes/ai.ts`

| Export | Description |
|---|---|
| `aiChatHandler` | POST handler — auth, RAG, system prompt build, streaming |
| `aiChatResumeHandler` | GET handler — returns 204 (no resumable stream storage yet) |
| `buildSystemPrompt` | Assembles the system prompt from user context + RAG chunks |
| `extractUserMessageText` | Normalises AI SDK message format (string / content array / parts array) |
| `shouldEnableTools` | Bilingual (EN + ID) heuristic deciding whether tools should be enabled |

**`streamText` configuration:**
- `temperature: 0` — deterministic output
- `stopWhen: stepCountIs(5)` — max 5 agentic steps per turn
- `toolChoice: 'required'` when tools are enabled

### `src/lib/ai-provider.ts`

| Env Variable | Default | Description |
|---|---|---|
| `AI_BASE_URL` | `http://localhost:20128/v1` | OpenAI-compatible endpoint |
| `AI_API_KEY` | `sk-a269...` | API key (override in production) |
| `AI_MODEL` | `chatbot` | Model name |
| `AI_DEVTOOLS_ENABLED` | `true` | Enable AI SDK DevTools middleware |

DevTools middleware is automatically disabled in `NODE_ENV=production`.

### `src/lib/ai-tools.ts`

All tools are **client-side** — no `execute` function. They are returned as tool calls in the stream and executed in the browser.

| Tool | Input | Action |
|---|---|---|
| `navigateTo` | `path`, `reason` | Navigate user to the given app route |
| `fillFormFields` | `fields` (key → value map) | Pre-fill form inputs on the active page |
| `getPageContext` | `reason` (optional) | Scrape DOM `[data-ai-context]` annotations |

---

## Client Components

### `AiAssistant.tsx`

Floating chat panel mounted globally in `PrivateLayout`.

**Key state:**

| State | Description |
|---|---|
| `open` | Panel open/closed |
| `isExpanded` | Wide mode (360px → 680px) |
| `input` | Current textarea value |
| `handledToolCallsRef` | Set of executed `toolCallId`s — prevents double-fire |

---

### `createPatchedFetch()`

**Problem:** Local OpenAI-compatible models emit `finishReason: "other"` instead of `"tool-calls"`. The AI SDK only emits `tool-input-available` (which triggers `onToolCall`) after receiving a proper finish reason. Without it, tool parts are stuck in `input-streaming` state forever and navigation never executes.

**Solution:** Intercept the SSE response stream at the `fetch` level (POST only), accumulate `tool-input-delta` text per `toolCallId`, and inject a synthetic `tool-input-available` event with the assembled JSON input immediately before each `finish-step` event.

```
Raw stream from model:
  tool-input-start  (toolCallId, toolName)
  tool-input-delta  (inputTextDelta: '{"')
  tool-input-delta  (inputTextDelta: 'path')
  tool-input-delta  (inputTextDelta: '":"/skus"}')
  finish-step       (finishReason: "other")    ← no tool-input-available

After patch (injected before finish-step):
  tool-input-start
  tool-input-delta ×N
  [INJECTED] tool-input-available  { type, toolCallId, toolName, input: {path: "/skus"} }
  finish-step
  finish

Result: AI SDK transitions tool part → input-available → onToolCall fires → navigate()
```

Only POST responses with a body are patched. GET (resume) and 204 responses pass through unmodified.

---

### `runTool(toolName, toolCallId, input)`

Central tool executor. Deduplicated by `handledToolCallsRef` to prevent double execution from `onToolCall` + `useEffect` both firing.

| Tool | Client Action |
|---|---|
| `navigateTo` | `navigate(normalizeRoutePath(path))` via React Router |
| `fillFormFields` | Set `aiFormFillAtom` — read by form pages to pre-fill fields |
| `getPageContext` | Call `collectPageContext()`, return result via `addToolOutput` |

**`ROUTE_ALIASES`** maps model-generated route variants (e.g. `/sku`) to canonical routes (e.g. `/skus`).

---

### `collectPageContext()`

Scrapes live DOM state to give the model accurate information about what is currently on screen:

| Source | Data Collected |
|---|---|
| `[data-ai-context]` attributes | Structured section data (records, IDs, pagination, form fields) |
| `<h1>` | Page heading |
| `document.title` | Browser tab title (trimmed) |
| `button` elements | Visible button labels (max 8) |
| `table`, `[role="table"]` | Count of visible tables |
| `input`, `textarea`, `select` | Count of visible form controls |
| Form sections | Snapshot of current input values (by `name` attribute) |

---

## System Prompt Structure

Built dynamically per request in `buildSystemPrompt()`:

```
You are ERP Assistant for {userName} ({roleName}).

## Permissions
{resource@action list}

## Route Catalog
{ROUTE_CATALOG}

## Instructions
- Never mention route paths in responses — use human-readable module names only.
- Call getPageContext when the user asks about visible data.
- fillFormFields only pre-fills inputs; it does NOT save or submit data.
- Never claim data was saved after fillFormFields.
- ...

## Retrieved Knowledge        ← present only when RAG returns results
{relevant markdown chunks}

## Current Page Context       ← present only when getPageContext was called
{DOM-scraped JSON}
```

---

## Adding a New Page to AI Context

**1. Annotate the page root with `data-ai-context`:**

```tsx
<section
  data-ai-context={JSON.stringify({
    section: 'sku-list',
    totalRecords: total,
    currentPage,
    totalPages,
    visibleRows: data.map(r => ({ id: r.id, skuCode: r.skuCode, skuName: r.skuName })),
  })}
>
```

**2. Add the module to `src/knowledge/pages.md`** under the appropriate table.

**3. Re-ingest knowledge:**

```bash
bun src/scripts/ingest-knowledge.ts
# or
bun run db:seed
```

---

## Adding a New Tool

1. Define the tool in `src/lib/ai-tools.ts` (no `execute`).
2. Add the handler branch in `runTool()` in `AiAssistant.tsx`.
3. Add an entry to `TOOL_META` for the chip label and icon.
4. Update `shouldEnableTools` in `src/routes/ai.ts` if the tool needs new trigger keywords.

---

## Running the Ingestion Script

```bash
# From apps/server/
bun src/scripts/ingest-knowledge.ts
```

Output example:
```
Reading knowledge files from: .../src/knowledge
Found 6 knowledge file(s): [ 'approvals.md', 'forms.md', ... ]
Cleared existing knowledge chunks.
  approvals.md: 4 chunk(s) ingested
  forms.md: 12 chunk(s) ingested
  ...
✓ Ingestion complete: 47 total chunks stored.
```
