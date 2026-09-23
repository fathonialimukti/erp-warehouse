import type { NextFunction, Request, Response } from 'express';
import { parse as parseCookie } from 'cookie';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * First-party Origin/Referer fallback for clients whose in-memory CSRF token
 * is missing (reload race before `/api/csrf` refetch, Tauri webview without a
 * shared cookie jar). Browsers enforce Origin/Referer on mutating fetches and
 * an attacker page cannot spoof them, so an allowlisted Origin is equivalent
 * proof of first-party intent. This never *replaces* the double-submit check —
 * it only rescues legitimate first-party requests that fail it.
 */
export const isFirstPartyOrigin = (req: Request, allowedOrigins: string[]): boolean => {
    const candidates = [req.headers.origin, req.headers.referer].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
    );
    return candidates.some((candidate) => {
        // Non-http(s) schemes (e.g. tauri://) have an opaque origin of
        // 'null', so match the dev/Tauri shapes against the raw candidate
        // as well as the parsed origin.
        let origin: string | null = null;
        try {
            const parsed = new URL(candidate).origin;
            origin = parsed === 'null' ? null : parsed;
        } catch {
            origin = null;
        }
        const values = origin ? [origin, candidate] : [candidate];
        if (values.some((value) => allowedOrigins.includes(value))) return true;
        // Dev + Tauri first-party shapes (Vite dev server, Tauri webview).
        return values.some(
            (value) =>
                /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value) ||
                /^tauri:\/\/localhost(:\d+)?$/.test(value) ||
                /^https?:\/\/tauri\.localhost(:\d+)?$/.test(value),
        );
    });
};

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
        const cookies = parseCookie(req.headers.cookie ?? '');
        if (!cookies.access_token) {
            next();
            return;
        }
        const headerToken = req.headers['x-csrf-token'];
        const cookieToken = cookies.csrf_token;
        if (typeof headerToken === 'string' && cookieToken && headerToken === cookieToken) {
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
        res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_TOKEN_INVALID' });
    };
};
