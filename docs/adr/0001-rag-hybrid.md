# ADR 0001: Hybrid FTS + pgvector retrieval for the knowledge base

- **Status:** Accepted
- **Date:** 2026-08-17 (shipped in `2823275`)
- **Scope:** `apps/server/src/lib/rag.ts`, `ai-embedding.ts`, `knowledge-ingest.ts`

## Context

Two read paths needed two different answers.

`landingRouter.getScene` (`apps/server/src/routers/landing.ts`) is an exact
relational read: find `WH01`, load its storage locations with pallets and SKUs,
order by id for a deterministic 3D layout. Prisma relations suffice — no
ranking, no fuzzy matching, no search.

The AI assistant's knowledge lookup is the opposite problem. Behavior and ops
docs live in `KnowledgeDocument` (source of truth), derived into
`knowledge_chunks` by heading-aware splitting (`splitIntoChunks`, 800 chars).
The assistant must retrieve the right chunks both by exact terms (document
numbers, SKU codes, approval keywords) and by meaning ("what needs attention
before dispatch?"), over bilingual EN/ID content, with no new infrastructure.

## Decision

Hybrid retrieval in `searchKnowledgeChunks` (default top 5):

- **FTS always runs.** `to_tsvector('english', title || ' ' || content) @@
  plainto_tsquery(...)`, ranked by `ts_rank`, backed by the GIN index ensured
  by `ensureKnowledgeFtsIndex`. Zero external dependencies.
- **Vector search is added when available.** Cosine similarity
  (`1 - (embedding <=> $2::vector)`) with a configurable threshold (default
  `0.5` via `ai.similarityThreshold`), in a read-only transaction with bound
  params. Embeddings come from the OpenAI-compatible provider (Upstage
  `solar-embedding-2-query`, 1024 dims zero-padded to the `vector(1536)`
  column enabled by `CREATE EXTENSION vector` in the init migration).
  Missing config, zero embedded rows, or any error yields `[]` — never throws.
- **Merge and inject.** `mergeKnowledgeHits` dedupes by id (falling back to
  content), keeps the higher rank, sorts desc, slices to limit;
  `formatKnowledgeHits` injects chunks as `### title` markdown into the system
  prompt. The pre-hybrid `retrieveRelevantChunks` signature was kept so
  `routes/ai.ts` consumed the upgrade unchanged.
- **Write path stays fire-and-forget.** Chunk reindex triggers
  `embedKnowledgeChunkBestEffort` without blocking the mutation; chunk status
  (`PENDING` / `EMBEDDED` / `FAILED`) records the outcome, and gaps silently
  fall back to FTS-only.

Forward AI work (drafting, analytics, reorder, approval, anomaly — see
`docs/plans/ai-features/PLAN.md`) consumes this retrieval layer unchanged.
That plan is a work order; this ADR is the record of the retrieval decision.

## Ruled-out alternatives

1. **FTS-only (the pre-hybrid status quo).** Rejected as the sole path:
   exact-term matching misses paraphrases and synonyms, which matters for
   bilingual EN/ID content and natural-language ops questions. Kept as the
   guaranteed fallback instead.
2. **Vector-only.** Rejected as the sole path: embeddings miss exact codes and
   numbers users paste verbatim; every chunk needs a backfilled embedding
   (`scripts/embed-knowledge.ts` CLI plus best-effort auto-embed); and with no
   AI key configured the assistant would get zero context instead of degraded
   context.
3. **External vector DB / dedicated search service.** Rejected: new
   infrastructure, new dependencies, and a new auth surface for a corpus of
   small doc chunks that Postgres already serves via one extension. Violates
   the no-new-deps constraint the AI stack works under.

## Consequences

- Retrieval never throws: the chat endpoint degrades to less context, never a
  500, when FTS or the embedding provider is unavailable.
- Rank scales are mixed (`ts_rank` vs. cosine similarity) and merged by
  relative order, not calibrated scores — accepted for top-5 prompt injection,
  not for precise ranking.
- Mutations never block on the embedding provider, at the cost of chunks that
  can sit at `PENDING`/`FAILED` until the embed CLI or a reindex retries them.
