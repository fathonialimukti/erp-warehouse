# Runbooks — Common Operations

## Deploy a Release

### Staging

```sh
git checkout main && git pull
bun run changeset version     # if there are pending changesets
bun run build
pm2 restart ecosystem.config.cjs
bun run --cwd apps/server db:migrate:deploy
bun run --cwd apps/server db:ensure-permissions
```

### Production

```sh
git checkout main && git pull
bun run prod:init              # build + pm2 start
bun run prod:restart
bun run --cwd apps/server db:migrate:deploy
bun run --cwd apps/server db:ensure-permissions
```

## Rollback

```sh
# Revert to previous git tag
git revert <bad-commit>
bun run build
pm2 restart ecosystem.config.cjs
```

## Seed / Reset Database

```sh
# Dev only — destroys all data
bun run --cwd apps/server db:all

# Production-safe — applies pending migrations only
bun run --cwd apps/server db:migrate:deploy
```

## AI Knowledge Re-index

```sh
# Ingest new knowledge docs
bun run --cwd apps/server ai:ingest

# Generate embeddings for pending chunks
bun run --cwd apps/server ai:embed
```

## Troubleshooting

### "tRPC procedure returns 401"

1. Check JWT cookie is present in browser dev tools
2. Verify `tokenVersion` hasn't been bumped (admin password reset, account disable)
3. Check `hasPermission` guard in the router — the user may lack the required role

### "CSRF token mismatch"

1. The client auto-retries once on mismatch — check browser console for retries
2. If it persists, the cookie and header may be on different origins
3. Verify `CORS_ORIGIN` matches the client origin

### "Database connection pool exhausted"

1. Check `DB_POOL_MAX` setting (default: 10)
2. Check for long-running queries — see **System → Logs**
3. Restart the server to clear the pool

### "E2E tests fail with HeroUI Select"

Known issue: HeroUI's `Select.Popover` with `ListBox` doesn't render options
in headless Chromium. See `apps/client/src/tests/e2e/shipment.spec.ts` for
workaround. This is being tracked.
