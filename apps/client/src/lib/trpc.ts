import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';
import { getCsrfToken } from './csrf.js';

// In dev, use Vite proxy (relative URL = same-origin, no CORS).
// In production, use VITE_TRPC_URL or the production subdomain.
const trpcBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_TRPC_URL ?? 'https://erp-warehouse-api.aetherglo.com');

/** Base URL for non-tRPC endpoints (SSE streams, /api/*). */
export const apiBaseUrl = trpcBaseUrl;

export type AppRouterType = AppRouter;

// ── Rate-limit "wait" fetch ─────────────────────────────────────────────────
// When the server responds 429 + Retry-After, requests wait silently and are
// retried automatically (the server-side limiter queues them too, so 429s
// only happen under saturation). A Jotai counter drives a subtle "Waiting…"
// pill in the Navbar — the user never sees an error.
const MAX_AUTO_RETRIES = 3;
const MAX_TOTAL_WAIT_MS = 30_000;

const waitingListeners = new Set<(delta: number) => void>();

/** Subscribe to wait-state changes (used by the Navbar indicator). */
export function onApiWaitingChange(listener: (delta: number) => void): () => void {
  waitingListeners.add(listener);
  return () => waitingListeners.delete(listener);
}

const emitWaiting = (delta: number) => {
  for (const listener of waitingListeners) listener(delta);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFetch(url: RequestInfo | URL, options: RequestInit | undefined): Promise<Response> {
  let attempt = 0;
  let totalWaited = 0;

  for (;;) {
    const response = await fetch(url, options);
    if (response.status !== 429 || attempt >= MAX_AUTO_RETRIES || totalWaited >= MAX_TOTAL_WAIT_MS) {
      return response;
    }

    attempt += 1;
    const retryAfterHeader = response.headers.get('retry-after');
    let delayMs = retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))
      ? Number(retryAfterHeader) * 1000
      : 1000 * attempt;
    try {
      const body = (await response.clone().json()) as { retryAfter?: number };
      if (typeof body.retryAfter === 'number' && body.retryAfter > 0) {
        delayMs = body.retryAfter * 1000;
      }
    } catch {
      // non-JSON body — fall back to header value
    }
    delayMs = Math.min(delayMs, MAX_TOTAL_WAIT_MS - totalWaited, 15_000);
    if (delayMs <= 0) return response;

    totalWaited += delayMs;
    emitWaiting(1);
    try {
      await sleep(delayMs);
    } finally {
      emitWaiting(-1);
    }
  }
}

export const trpcClient = createTRPCClient<AppRouterType>({
  links: [
    httpBatchLink({
      url: `${trpcBaseUrl}/trpc`,
      fetch(url, options) {
        const headers = new Headers(options?.headers);

        // Attach CSRF token for mutations (double-submit pattern)
        const method = options?.method?.toUpperCase() ?? 'GET';
        if (method !== 'GET' && method !== 'HEAD') {
          const csrfToken = getCsrfToken();
          if (csrfToken) {
            headers.set('x-csrf-token', csrfToken);
          }
        }

        return waitFetch(url, { ...options, headers, credentials: 'include' });
      },
    }),
  ],
});

// Re-export for use with React Query
export type TRPCClient = typeof trpcClient;
