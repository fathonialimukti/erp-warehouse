# Changelog

> **This file is maintained by hand.** There is no changeset automation in this
> repo — add an entry under `## [Unreleased]` when you merge, and move it under
> a version heading at release time. Nothing will regenerate or overwrite it.

All notable changes to this project are recorded here, newest first within
each section. Dates are the commit dates from git history.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- AI chat: interactive chat forms, RAG putaway/pick analysis, admin DML
  approval (2026-09-15, 2026-09-25).
- Forms: 18 document pages unified on the FormPageShell kit with page-aware AI
  assist (2026-09-24).
- AI provider: Routers9 models with context and output limits (2026-09-17).
- Landing: RAG showcase section with Mermaid architecture diagram, AI
  Knowledge nav, EN/ID i18n (2026-08-19).
- Seed: real-world warehouse roles (10-role SoD), location bootstrap,
  `SEED_MONTHS` wiring, vitest glob (2026-08-18).
- AI knowledge: embeddings over FTS+vector hybrid RAG — pgvector column,
  batch embed CLI, best-effort auto-embed on reindex (2026-08-17).
- Seed: deterministic seeder — rng scaffolding, ISO 6346 container check
  digit, master data catalog, demand plan with invariant helpers, access /
  master / receiving / internal / balances steps (2026-08-16 – 2026-08-18).
- AI portfolio features: transaction drafting, analytics, reorder assistant,
  approval narratives, anomaly detection, insights, digest, voice ops; AI Fill
  modal; lazy-loaded AI cards (2026-08-13 – 2026-08-16).
- RAG foundation for the AI assistant (2026-07-21).

### Fixed

- Seed: raw material package names (2026-08-19).
- Seed: interleave transactions by month so inbound drains within capacity
  (2026-08-18).
- Seed: internal step `sourceItemId` points at the item, RTS supplier throws on
  missing, receiving pallet `sourceItemId` points at the item, assembler-flow
  demand plan volumes (2026-08-17).

### Security

- CSRF: hardened double-submit middleware with client retry (2026-09-23).
- Server hardening: CSRF, helmet, rate limiting, XSS, JWT enforcement,
  graceful shutdown, pino logging; admin AI read-only enforcement; auth
  middleware extraction with env validation (2026-09-03).
- Permissions/roles/users seeded as the access-control baseline; synced docs
  to implementation and removed deprecated insights/pages (2026-08-17,
  2026-09-03).
