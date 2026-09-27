# ADR 0003: Wait-Queue Rate Limiting

- **Status:** Accepted
- **Date:** 2026-09-03 (shipped in `68e93bc`)
- **Scope:** `apps/server/src/middleware/rate-limit.ts`, `apps/client/src/lib/retry.ts`

## Context

The ERP Warehouse is a data-dense admin tool where multiple operators work
simultaneously — receiving clerks, putaway operators, warehouse managers
reviewing approvals. Without rate limiting:

- A single client (or buggy script) can flood the API
- Database connection pool exhaustion under load
- Brute-force attacks on the login endpoint
- No fairness between users — one noisy client starves others

Traditional rate limiting returns `429 Too Many Requests` — but that fails
the request. For a warehouse floor application, **failing a request means
losing data** (a clerk's transaction is rejected). The system should instead
**wait** and process the request when capacity is available.

## Decision

**Per-user/IP wait-queue token bucket with client-side auto-retry.**

### Server side

- Token bucket per user (by `userId` from JWT) and per IP (fallback for
  unauthenticated requests like login)
- Configurable via system settings: `rateLimit.max`, `rateLimit.windowMs`,
  `rateLimit.waitTimeoutMs`
- When the bucket is empty, the request **waits** (up to `waitTimeoutMs`)
  for a token to refill instead of returning 429
- Default: 100 requests per 60 seconds per user, 30-second wait timeout

### Client side

- On receiving a `429` with a `Retry-After` header, the client automatically
  waits and retries the request
- A subtle "Waiting…" indicator shows in the UI during retries
- Retries are transparent — the calling code sees a single resolved promise

### Implementation

```
Request arrives
    │
    ▼
Rate limit middleware
    ├── Token available → proceed
    └── Token exhausted → queue → wait for refill → proceed (or timeout → 429)
```

## Ruled-out alternatives

1. **Fixed-window counter (reject on limit).** Rejected: loses data on
   warehouse floor. A rejected receiving transaction means the clerk must
   re-enter everything.

2. **Sliding-window log.** Rejected: O(n) per request (stores timestamps).
   Acceptable for small scale but doesn't compose with per-user + per-IP
   dual keys.

3. **Third-party rate limiting service (e.g., Cloudflare).** Rejected:
   external dependency, adds latency, and doesn't integrate with the
   per-user permission model. Also breaks the Tauri desktop offline story.

4. **No rate limiting.** Rejected: database pool exhaustion under load,
   no brute-force protection, no fairness between users.

## Consequences

- **Positive:**
  - No data loss — requests wait instead of failing
  - Per-user fairness — one noisy user doesn't starve others
  - IP-based protection for unauthenticated endpoints (login)
  - Settings-driven — tunable at runtime under **System → Settings**
  - Transparent client retry — no application code changes needed

- **Trade-offs:**
  - Requests can be delayed under load (up to `waitTimeoutMs`)
  - Token bucket state is in-memory — lost on server restart (resets to full)
  - Per-IP limiting can be too aggressive behind shared NAT (offices)

## Verification

- `bunx vitest run rate-limit` — middleware tests
- E2E: system settings page shows rate limiting group
- Manual: flood the API with concurrent requests and observe wait behavior
