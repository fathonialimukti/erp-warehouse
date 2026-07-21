# Knowledge Base Client CRUD — Implementation Plan

**Goal:** Admin CRUD for RAG knowledge documents in the client; DB source of truth; re-chunk on save.

**Architecture:** `KnowledgeDocument` + derived `KnowledgeChunk`; tRPC `knowledge.*`; Index/Detail/Form pages.

## Tasks

1. **Backend** — schemas, Prisma model/migration, knowledge-ingest lib, router, seed permissions + MD bootstrap, CLI update, wire router, minimal tests
2. **Frontend** — pages, routes, nav, icon, locales (parallel with backend)
3. **Review** — Code Reviewer after both land

## Dispatch

- Backend Engineer + Frontend Engineer in parallel with frozen CONTEXT
- Code Reviewer after synthesis
