# Monitoring & Observability

## Logging

The server uses **pino** for structured JSON logging. Logs are written to
stdout and persisted to the database (`SystemLog` table) for live tailing.

### Log levels

| Level   | When                 |
| ------- | -------------------- |
| `trace` | Verbose debugging    |
| `debug` | Development only     |
| `info`  | Default              |
| `warn`  | Degraded performance |
| `error` | Request failures     |
| `fatal` | Server crash         |

Configured via `LOG_LEVEL` environment variable or **System → Settings →
Logging** at runtime.

### Live log viewer

**System → Logs** in the app shows a live SSE tail of system logs with level
filtering and search. Retention policy is configurable under **System →
Settings → Logging**.

### Redaction

`csrf_token` and `Authorization` headers are redacted from logs automatically.
See `apps/server/src/middleware/logger.ts`.

## Metrics

### What to watch

| Metric                        | Source          | Alert threshold |
| ----------------------------- | --------------- | --------------- |
| HTTP 5xx rate                 | pino logs       | > 1% over 5 min |
| tRPC procedure latency        | pino logs       | p95 > 2s        |
| DB connection pool exhaustion | pino logs       | pool maxed      |
| Failed login attempts         | auth middleware | > 5/min per IP  |
| AI chat errors                | `routes/ai.ts`  | any non-2xx     |
| Backup failures               | backup service  | any failure     |

### Dashboard

No external dashboard is configured. Logs are queryable via:

- **System → Logs** (in-app SSE tail)
- `psql $DATABASE_URL` (direct SQL on `SystemLog` table)

## Alerting

- **Email**: SMTP notifications for approval events, reorder alerts, monthly
  reports (configured under **System → Settings → Mail**)
- **In-app**: Real-time notification stream (SSE) for approval requests,
  system alerts
- **PM2**: `pm2 restart` on crash (configured in `ecosystem.config.cjs`)

## Health Checks

| Endpoint      | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `GET /health` | Liveness — server is running                       |
| `GET /ready`  | Readiness — DB is connected and migrations applied |

Used by PM2 and load balancers.
