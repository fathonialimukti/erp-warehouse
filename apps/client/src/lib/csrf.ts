/**
 * CSRF double-submit wiring for first-party API calls.
 *
 * The server (`validateCsrf`) rejects every POST/PUT/PATCH/DELETE whose
 * `x-csrf-token` header does not exactly match the `csrf_token` cookie set by
 * `GET /api/csrf`. Two client bugs produced `{"error":"Invalid CSRF token"}`
 * on normal use:
 *
 * 1. Relative `/api/*` URLs hit the wrong host in production/Tauri (tRPC goes
 *    to the absolute API origin while `/api/csrf` + `/api/ai/*` went to the
 *    client origin / Tauri scheme), so the cookie was never the one the API
 *    validated. All endpoints below reuse `apiBaseUrl` ('' in dev = Vite
 *    proxy, absolute API origin otherwise — same convention as `lib/trpc.ts`).
 * 2. Fire-and-forget `initCsrf()` + synchronous token reads meant the first
 *    mutations/AI sends raced ahead with no header, and any later
 *    token/cookie rotation (or expiry) 403'd permanently. Every mutating call
 *    now awaits `ensureCsrfToken()` and each transport retries once with a
 *    refreshed token after a 403 carrying the server's CSRF error body.
 */

// In dev, use the Vite proxy (relative URL = same-origin, no CORS).
// In production (web + Tauri), use VITE_TRPC_URL or the API subdomain.
export const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_TRPC_URL ?? 'https://erp-warehouse-api.aetherglo.com');

let csrfToken: string | null = null;
let inflight: Promise<string> | null = null;

export const getCsrfToken = () => csrfToken;

/** Headers object carrying the CSRF token for mutating requests (double-submit pattern). */
export const csrfHeaders = (): Record<string, string> =>
  csrfToken ? { 'x-csrf-token': csrfToken } : {};

async function requestToken(): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/api/csrf`, { credentials: 'include' });
  if (!res.ok) throw new Error(`CSRF bootstrap failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  // The endpoint sets a readable (`httpOnly: false`) `csrf_token` cookie AND
  // returns `{ token }` — accept either, so a body/cookie skew never bricks
  // the client (Tauri webviews may surface one but not the other).
  csrfToken = data.token ?? readCsrfCookie();
  if (!csrfToken) throw new Error('CSRF bootstrap returned no token');
  return csrfToken;
}

/** Read the `csrf_token` cookie directly (server sets it readable: `httpOnly: false`). */
const readCsrfCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  const raw = match?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return raw;
  }
};

/** Fetch a token, deduping concurrent callers into one request. */
export const fetchCsrfToken = async (): Promise<string> => {
  if (inflight) return inflight;
  inflight = requestToken();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

/** Return the cached token, fetching it first when absent (e.g. first mutation raced app boot). */
export const ensureCsrfToken = async (): Promise<string> => {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
};

/** Drop the cached token and fetch a fresh one (used before retrying a 403). */
export const refreshCsrfToken = async (): Promise<string> => {
  csrfToken = null;
  return fetchCsrfToken();
};

/** True when a response body is the server's refreshable CSRF rejection (not an auth/permission 403). */
export const isCsrfErrorBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') return false;
  const record = body as { code?: unknown; error?: unknown };
  // Exact contract: the server rejects with
  // `{ error: 'Invalid CSRF token', code: 'CSRF_TOKEN_INVALID' }`.
  // Plain 403s (auth/permission) carry different codes and must NOT be retried.
  if (record.code === 'CSRF_TOKEN_INVALID') return true;
  // Legacy shape (pre-code bodies): same error string with no code field.
  return record.code === undefined && record.error === 'Invalid CSRF token';
};

// ── Post-retry failure broadcast ────────────────────────────────────────────
// A failed retry (refresh threw, or the retried request was rejected again)
// must surface a visible user-facing error — never a silent dead app. Transports
// call `notifyCsrfFailure()` / `notifyIfStillCsrf()`; the mounted
// `CsrfFailureToast` component turns the broadcast into a HeroUI toast.

type CsrfFailureListener = () => void;

const csrfFailureListeners = new Set<CsrfFailureListener>();
let lastFailureNotifiedAt = 0;
const FAILURE_DEDUPE_MS = 60_000;

/** Subscribe to post-retry CSRF failures (drives the visible error toast). */
export const onCsrfFailure = (listener: CsrfFailureListener): (() => void) => {
  csrfFailureListeners.add(listener);
  return () => {
    csrfFailureListeners.delete(listener);
  };
};

/**
 * Broadcast that a request failed even after a token refresh + single retry.
 * Deduped so concurrent failures surface one toast, not a storm.
 */
export const notifyCsrfFailure = (): void => {
  const now = Date.now();
  if (now - lastFailureNotifiedAt < FAILURE_DEDUPE_MS) return;
  lastFailureNotifiedAt = now;
  for (const listener of csrfFailureListeners) listener();
};

/** After the single retry, notify when the response is still a CSRF rejection. Never throws. */
export const notifyIfStillCsrf = async (response: Response): Promise<void> => {
  if (response.status !== 403) return;
  try {
    if (isCsrfErrorBody(await response.clone().json())) notifyCsrfFailure();
  } catch {
    // non-JSON body — not a CSRF rejection, stay silent
  }
};

export const initCsrf = async (): Promise<void> => {
  await ensureCsrfToken().catch(() => {
    // Offline / API down at boot — mutating calls re-try on demand via ensureCsrfToken().
  });
  // Refresh every hour
  setInterval(() => {
    void refreshCsrfToken().catch(() => {});
  }, 60 * 60 * 1000);
};
