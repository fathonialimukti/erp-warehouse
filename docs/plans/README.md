# Shared agent context

Full-Stack Engineer writes one file per feature:

```text
docs/plans/<feature-slug>/CONTEXT.md
```

Subagents are stateless. This file + an inline paste under `### FROZEN CONTEXT` is how Backend / Frontend / Reviewer share one contract without re-gathering.

## Template

```markdown
# <feature-slug>

## Frozen Contract
- fields / types
- Zod shape
- tRPC procedures + permissions (`resource@action`)
- locale key prefixes
- response shapes

## Reference Files
- Backend: `apps/server/src/routers/...`
- Frontend: `apps/client/src/pages/...`
- Schema: `packages/schemas/src/...`

## Sibling Awareness
- Backend: …
- Frontend: …

## Do Not Re-derive
- closed design decisions
```

## Rules

1. Orchestrator writes CONTEXT.md once.
2. Every subagent prompt pastes the full file (not just the path).
3. Specialists implement the contract; they do not re-brainstorm or rediscover patterns.
