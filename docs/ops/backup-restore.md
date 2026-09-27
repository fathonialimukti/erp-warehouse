# Backup & Restore

## Backups

### Automated

The backup service runs on a schedule (configured under **System → Settings →
Backup**). It produces:

- **Full DB dump** — `pg_dump` of the `erp_warehouse` database
- **Encrypted archive** — AES-256-GCM encrypted, password-protected
- **Retention** — configurable retention window (default: 30 days)
- **Storage** — local disk (`apps/server/backups/`) or S3-compatible remote

### Manual

```sh
# Full backup
bun run --cwd apps/server backup:create

# Restore from latest
bun run --cwd apps/server backup:restore --latest

# Restore from specific backup
bun run --cwd apps/server backup:restore --file=backup_2026-09-27.tar.gz
```

### Backup script

Located at `apps/server/src/scripts/backup.ts`. Reads config from system
settings (schedule, retention, remote storage). Backups are stored in
`apps/server/backups/` (gitignored — never commit backups).

## Restore Procedure

### 1. Stop the application

```sh
pm2 stop ecosystem.config.cjs
```

### 2. Drop and recreate the database

```sh
bun run --cwd apps/server db:migrate reset --force
```

### 3. Restore from backup

```sh
bun run --cwd apps/server backup:restore --file=<backup-file>
```

### 4. Re-apply migrations

```sh
bun run --cwd apps/server db:migrate:deploy
```

### 5. Sync permissions

```sh
bun run --cwd apps/server db:ensure-permissions
```

### 6. Restart

```sh
pm2 restart ecosystem.config.cjs
```

## RTO / RPO

| Metric | Target |
|---|---|
| Recovery Time Objective | < 30 minutes |
| Recovery Point Objective | < 5 minutes (backup interval) |
| Retention | 30 days |

## Disaster Recovery

1. If the primary database is lost, restore from the most recent backup
2. If the backup is also lost, rebuild from the seed data (`db:seed`) — note
   this loses all transactional data
3. Contact the repo maintainer for off-site backup access
