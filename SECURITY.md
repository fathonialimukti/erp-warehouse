# Security Policy

## Supported versions

Only the latest `main` is supported with security fixes. There are no
maintained release branches — upgrade to current `main` before reporting.

| Version    | Supported |
| ---------- | --------- |
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
  `GET /api/csrf` re-issues the token; the client retries once on mismatch. In
  production only the double-submit pair or an explicit `CORS_ORIGIN`
  allowlist entry passes; the `http://localhost`, `http://tauri.localhost` and
  `tauri://localhost` first-party shapes are development-only.
- **Desktop shell scope:** the Tauri build is a **development client**, not a
  supported production client. Its origin is refused by CORS in production
  (`apps/server/src/lib/cors-policy.ts`) and by CSRF in production, because the
  `access_token` session cookie is `SameSite=lax` and a `tauri://localhost`
  webview fetching the API over https is cross-site, so the browser would never
  send the session back. Shipping a production desktop build is a deliberate
  change to `createAuthCookie` (`SameSite=none; Secure`) plus the CORS
  allowlist — not a config flag.
- **Lockout:** settings-driven (`security.lockoutMinutes`, max attempts) —
  repeated failures lock the account and log the attempt.
- **Password reset:** hashed, single-use tokens with expiry; admin reset
  revokes existing sessions.
- **Transport/API:** helmet headers, per-user/IP wait-queue rate limiting
  (requests wait instead of failing), output sanitisation on the XSS-prone
  write paths, JWT enforcement on every protected procedure, graceful shutdown.
- **Uploads:** `image/svg+xml` is rejected at upload time and excluded from the
  inline-serving set; `/uploads/**` is served with `X-Content-Type-Options:
nosniff` and `Content-Security-Policy: sandbox; default-src 'none'`, and
  every non-raster response is `Content-Disposition: attachment`. See
  `apps/server/src/lib/upload-file.ts`. The remaining gap is the advisory
  count in **Known limitations** below — the "XSS guards" claim is not a
  complete substitute for closing those.
- **Logging:** pino + DB system logs with `csrf_token` redacted; live SSE tail
  and retention policy under System → Settings.

## Known limitations

`bun audit` currently reports **39 advisories** (24 high, 13 moderate, 2 low;
0 critical) across the workspace. Most are **build/CLI-only and never loaded
into the served runtime**, but a few are real runtime risk and are still open.

**CLI / dev-only (not in the served request path):**

- Prisma's own transitive deps — `fast-uri`, `deepmerge-ts`, `mysql2` — pinned
  by `prisma@7.10.0`'s ranges. The app connects to **PostgreSQL only**
  (`@prisma/adapter-pg`), so the `mysql2` decompression-bomb and auth-downgrade
  advisories cannot be reached. `deepmerge-ts`/`fast-uri` run in the Prisma CLI,
  not at query time.
- Express's pinned `qs` / `body-parser` transitive versions, whose advisories
  are DoS-only (unbounded parse work), mitigated by the rate limiter and the
  per-user/IP wait queue.
- The ESLint toolchain (`minimatch`, `brace-expansion`, `picomatch`,
  `fast-uri`, `js-yaml`, `flatted` via ESLint's own tree) — lint-time only.

**Real runtime risk, still open (client-owned, tracked by the frontend owner):**

- `react-router@7.16.0` — 5 advisories, including a **high**-severity
  unauthenticated DoS in route matching (< 7.18.0) and an RSC-mode CSRF
  bypass (< 7.18.2). Fixed upstream; needs a `react-router` bump to `>= 7.18.2`.
- `xlsx@0.18.5` — 2 **high** advisories (prototype pollution, ReDoS) with **no
  published fix**; SheetJS moved its releases off npm. Needs a replacement or
  removal of the xlsx import path.
- `@vitest/browser` / `ws` / `vite` / `postcss` / `nanoid` / `browserslist` —
  dev-server and CSS-toolchain packages. They do not ship in the production
  bundle, but a malicious dependency in the toolchain could still affect the
  developer's machine.

We have not silently accepted these; the counts above are the measured
`bun audit` output, not an estimate. Re-run `bun audit` before relying on them.

Out of scope for reports: the `ci-test-secret-not-for-production` JWT secret
in `.github/workflows/ci.yml` (test-only), and the sign-in gate rendered by
the seeded demo captures.
