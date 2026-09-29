# ADR 0002: JWT Cookie Sessions with CSRF Double-Submit

- **Status:** Accepted
- **Date:** 2026-09-03 (shipped in `68e93bc`)
- **Scope:** `apps/server/src/middleware/auth.ts`, `csrf.ts`, `apps/server/src/routers/auth.ts`

## Context

The ERP Warehouse handles financial warehouse transactions — receiving,
putaway, picking, dispatch, returns, disposals. Every mutating request must
be authenticated and authorized. The system serves two clients:

1. **Tauri desktop** — local app, no cross-origin concerns
2. **Web browser** — cross-origin, CSRF-vulnerable

We needed an auth scheme that:

- Works identically across both clients (single codebase, desktop+web parity)
- Protects against CSRF without client-side token storage
- Supports token revocation (password change, admin reset, account disable)
- Supports account lockout after repeated failures

## Decision

**JWT cookie sessions with CSRF double-submit pattern.**

### Token flow

1. **Login** (`POST /api/auth/login`):
   - Validate email/password against bcrypt hash
   - Check account lockout (settings-driven: `security.lockoutMinutes`, max attempts)
   - On success: issue `access_token` JWT (HttpOnly, SameSite=Lax, 7-day expiry)
     with `tokenVersion` claim from the user's current `tokenVersion` column
   - On failure: increment attempt counter, lock account if threshold exceeded

2. **CSRF protection**:
   - `GET /api/csrf` re-issues a `csrf_token` cookie (non-HttpOnly, SameSite=Lax)
   - Every mutating request must include `x-csrf-token` header matching the cookie
   - Client auto-retries once on mismatch (403 → re-fetch CSRF → retry)

3. **Token revocation**:
   - `tokenVersion` column on `User` — bump it on password change, admin reset,
     account disable
   - All existing tokens with the old `tokenVersion` are silently rejected
   - No token blacklist needed — the version check is O(1) per request

### Middleware stack (order matters)

```
auth → csrf → rateLimit → procedure
```

- `auth.ts`: extracts JWT from cookie, verifies signature + tokenVersion,
  attaches `ctx.user` to the tRPC context
- `csrf.ts`: validates double-submit on mutating requests
- `rateLimit.ts`: per-user/IP wait-queue token bucket (requests _wait_,
  don't fail)

## Ruled-out alternatives

1. **Session-based (Postgres-backed) cookies.** Rejected: stateful sessions
   require a shared store, add latency per request, and complicate horizontal
   scaling. JWT is stateless and self-verifying.

2. **Bearer token in `localStorage`.** Rejected: XSS-vulnerable. The token is
   accessible to any injected script. HttpOnly cookies are the safer default.

3. **OAuth / external IdP.** Rejected: overkill for an internal ERP with a
   single tenant. Adds dependency on an external provider and complicates
   the user/role/permission model.

4. **HttpOnly cookie without CSRF.** Rejected: unprotected against
   cross-site request forgery. Any malicious site the user visits can
   trigger mutations (e.g., a transfer) while the browser sends the cookie.

## Consequences

- **Positive:**
  - Stateless auth — no session table, no cleanup job
  - Token revocation via `tokenVersion` bump — O(1), no blacklist
  - CSRF protection without client token storage — works for Tauri and web
  - Account lockout is settings-driven — tunable per deployment
  - Same auth flow for desktop and web — one codebase, parity preserved

- **Trade-offs:**
  - JWT expiry is fixed (7 days) — no per-session expiry. Mitigated by
    `tokenVersion` revocation.
  - CSRF token must be fetched before every mutating request batch. Client
    caches it and retries on mismatch.
  - `SameSite=Lax` provides partial protection against cross-site POSTs;
    strict would break the Tauri desktop webview.

## Verification

- `bunx vitest run csrf` — CSRF middleware tests
- `bunx vitest run auth` — auth procedure tests
- E2E: `apps/client/src/tests/e2e/auth.spec.ts` — login, invalid creds,
  landing page, demo button
