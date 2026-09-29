import type { NextFunction, Request, Response } from "express";
import { parse as parseCookie } from "cookie";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * First-party Origin/Referer fallback for clients whose in-memory CSRF token
 * is missing (reload race before `/api/csrf` refetch, Tauri webview without a
 * shared cookie jar). Browsers enforce Origin/Referer on mutating fetches and
 * an attacker page cannot spoof them, so an allowlisted Origin is equivalent
 * proof of first-party intent. This never *replaces* the double-submit check —
 * it only rescues legitimate first-party requests that fail it.
 *
 * Policy (deliberate, and enforced — see `isDevFirstPartyOrigin`):
 *   - production requires the real double-submit token, or an explicit
 *     `CORS_ORIGIN` allowlist entry. Nothing else passes.
 *   - the dev/Tauri shapes below are development-only conveniences.
 *
 * The Tauri desktop build is DEV-ONLY. It is not a supported production
 * client, and the reason is structural rather than a missing config line: the
 * `access_token` session cookie is `SameSite=lax`
 * (`src/routers/auth.ts` → `createAuthCookie`), and a `tauri://localhost`
 * webview fetching the API over https is cross-site, so the browser never
 * sends it back. There is no session, so there is nothing for CSRF to
 * protect. Making the desktop build work in production would mean
 * `SameSite=none; Secure` on the session cookie — a real weakening of the web
 * deployment's posture for a shell that has no signing config, no updater and
 * no release job. Supporting it is a deliberate future change to
 * `createAuthCookie` + CORS, not a line in this file.
 */
export const isFirstPartyOrigin = (
  req: Request,
  allowedOrigins: string[],
): boolean => {
  const candidates = [req.headers.origin, req.headers.referer].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return candidates.some((candidate) => {
    // Non-http(s) schemes (e.g. tauri://) have an opaque origin of
    // 'null', so match the dev/Tauri shapes against the raw candidate
    // as well as the parsed origin.
    let origin: string | null = null;
    try {
      const parsed = new URL(candidate).origin;
      origin = parsed === "null" ? null : parsed;
    } catch {
      origin = null;
    }
    const values = origin ? [origin, candidate] : [candidate];
    if (values.some((value) => allowedOrigins.includes(value))) return true;
    return !isProduction() && values.some(isDevFirstPartyOrigin);
  });
};

/** `NODE_ENV=production` is read per call so tests can stub it. */
const isProduction = () => process.env.NODE_ENV === "production";

/**
 * The development-only first-party shapes: the Vite dev server and the Tauri
 * webview. NOT valid in production — see the policy note above.
 *
 * `http://localhost` / `127.0.0.1` are the dangerous ones: any page the victim
 * opens on their own machine (a rogue app on http://localhost:PORT) carries a
 * matching Origin and would get a free pass on the double-submit check while
 * the victim's `access_token` cookie rides along. Development only is a real
 * gate rather than a technicality, because a developer is running a local
 * server they control.
 */
const isDevFirstPartyOrigin = (value: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value) ||
  /^tauri:\/\/localhost(:\d+)?$/.test(value) ||
  /^https?:\/\/tauri\.localhost(:\d+)?$/.test(value);

/**
 * Double-submit CSRF validation for mutating requests.
 *
 * Passes when EITHER the `x-csrf-token` header equals the `csrf_token`
 * cookie OR the request is provably first-party (see `isFirstPartyOrigin`).
 * Requests carrying no `access_token` session cookie (auth.login, demoLogin,
 * password reset, first visit) skip the check entirely — with no ambient
 * credential there is nothing to forge, and requiring double-submit there
 * chicken-eggs every public mutation with `Invalid CSRF token`.
 */
export const createCsrfMiddleware = (allowedOrigins: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }
    const cookies = parseCookie(req.headers.cookie ?? "");
    if (!cookies.access_token) {
      next();
      return;
    }
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = cookies.csrf_token;
    if (
      typeof headerToken === "string" &&
      cookieToken &&
      headerToken === cookieToken
    ) {
      next();
      return;
    }
    if (isFirstPartyOrigin(req, allowedOrigins)) {
      next();
      return;
    }
    // Refreshable rejection: the client refetches GET /api/csrf (which
    // re-issues the `csrf_token` cookie + `{ token }` body) and retries
    // the failed request ONCE with `x-csrf-token: <token>`. The `code`
    // field is the retry signal — plain 403s must not be retried.
    res
      .status(403)
      .json({ error: "Invalid CSRF token", code: "CSRF_TOKEN_INVALID" });
  };
};
