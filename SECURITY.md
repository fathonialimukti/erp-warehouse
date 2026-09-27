# Security Policy

## Supported versions

Only the latest `main` is supported with security fixes. There are no
maintained release branches — upgrade to current `main` before reporting.

| Version    | Supported |
|------------|-----------|
| `main` tip | ✅        |
| Older      | ❌        |

## Reporting a vulnerability

Do not open a public issue. Email the maintainer privately (see the repo
owner profile) with: affected route/version, reproduction steps, and impact.
Expect an acknowledgement within 72 hours; fixes ship on `main` with a
`CHANGELOG.md` entry under `Security`.

## Hardening already in place

Mirror of the shipped posture (`CHANGELOG.md` → Security, 2026-09-03 /
2026-09-23) — do not regress these:

- **Auth:** JWT cookie sessions (`access_token`, `HttpOnly`); revocation via
  per-user `tokenVersion` bump (password change, admin reset, disable).
- **CSRF:** double-submit — `csrf_token` cookie must equal the
  `x-csrf-token` header on mutating requests (`apps/server/src/middleware/csrf.ts`).
  `GET /api/csrf` re-issues the token; the client retries once on mismatch.
- **Lockout:** settings-driven (`security.lockoutMinutes`, max attempts) —
  repeated failures lock the account and log the attempt.
- **Password reset:** hashed, single-use tokens with expiry; admin reset
  revokes existing sessions.
- **Transport/API:** helmet headers, per-user/IP wait-queue rate limiting
  (requests wait instead of failing), XSS guards, JWT enforcement on every
  protected procedure, graceful shutdown.
- **Logging:** pino + DB system logs with `csrf_token` redacted; live SSE tail
  and retention policy under System → Settings.

Out of scope for reports: the `ci-test-secret-not-for-production` JWT secret
in `.github/workflows/ci.yml` (test-only), and the sign-in gate rendered by
the seeded demo captures.
