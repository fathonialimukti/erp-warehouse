# Contributing

Short and enforceable. If it is not on this list, use your judgment and keep
the diff small.

## Commits

- **One concern per commit.** A commit does exactly one thing
  (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`). Do not bundle a seed
  fix with an AI feature.
- **Human author, always.** The `Author:` of every commit is a human. AI
  assistance is disclosed with a `Co-authored-by:` trailer. A bot is never the
  author.

## Merging

- **PR before merge on `main`.** Nothing lands on `main` without a pull
  request and review. Never push to `main` directly.

## Before opening a PR

- `bun run check-types` passes.
- Scoped tests pass: `bunx vitest run <path>` for the area touched.
- Match existing architecture; extend, don't replace. Never delete or disable
  existing behavior, routes, fields, or UI unless the task explicitly asks.

## Branch protection

`main` is protected: PRs required, CI must pass, review
approval required before merge. Nothing lands on `main` directly.
