# Pull Request

## Summary

<!-- One sentence: what does this PR do? -->

## Type of Change

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — Code restructuring (no behavior change)
- [ ] `chore` — Build, tooling, docs
- [ ] `docs` — Documentation only
- [ ] `test` — Tests only

## Checklist

- [ ] `bun run check-types` passes
- [ ] `bun run lint` passes (0 warnings)
- [ ] `bunx vitest run <path>` passes for touched areas
- [ ] E2E tests pass: `bun run --cwd apps/client test`
- [ ] Conventional commit message format followed
- [ ] One concern per commit; no bundled unrelated changes
- [ ] Human author; AI assistance disclosed via `Co-authored-by:` trailer
- [ ] PR targets `main`; nothing lands on main directly

## Affected Areas

- [ ] `apps/server` (routers, Prisma, middleware)
- [ ] `apps/client` (pages, components, hooks, i18n)
- [ ] `packages/schemas` (shared Zod schemas)
- [ ] `packages/eslint-config` or `packages/typescript-config`

## Notes

<!-- Anything reviewers should know? Breaking changes, edge cases, follow-ups? -->
