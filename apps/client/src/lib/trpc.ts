import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';
import {
  apiBaseUrl,
  ensureCsrfToken,
  getCsrfToken,
  isCsrfErrorBody,
  notifyCsrfFailure,
  notifyIfStillCsrf,
  refreshCsrfToken,
} from './csrf.js';

export { apiBaseUrl };

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
      url: `${apiBaseUrl}/trpc`,
      async fetch(url, options) {
        // httpBatchLink sends every batch (queries included) as POST, and the
        // server CSRF middleware rejects any POST without a matching
        // x-csrf-token header — so await the token instead of racing app boot.
        const method = options?.method?.toUpperCase() ?? 'GET';
        const mutating = method !== 'GET' && method !== 'HEAD';

        const withToken = (base: HeadersInit | undefined, token: string | null) => {
          const headers = new Headers(base);
          if (mutating && token) headers.set('x-csrf-token', token);
          return headers;
        };

        if (mutating) {
          try {
            await ensureCsrfToken();
          } catch {
            // Proceed without a token; the server decides (and we retry below on CSRF 403s).
          }
        }

        let response = await waitFetch(url, {
          ...options,
          headers: withToken(options?.headers, getCsrfToken()),
          credentials: 'include',
        });

        // Token/cookie rotation (or expiry) between calls surfaces as a CSRF
        // 403 — refresh once and retry instead of failing the mutation.
        if (mutating && response.status === 403) {
          let csrf = false;
          try {
            csrf = isCsrfErrorBody(await response.clone().json());
          } catch {
            // non-JSON body — not a CSRF rejection, fall through
          }
          if (csrf) {
            try {
              await refreshCsrfToken();
            } catch {
              // Refresh failed — the retry is impossible. Surface visibly
              // instead of leaving the app silently unusable.
              notifyCsrfFailure();
              return response;
            }
            response = await waitFetch(url, {
              ...options,
              headers: withToken(options?.headers, getCsrfToken()),
              credentials: 'include',
            });
            // Retried request still rejected — surface visibly (toast), never silent.
            await notifyIfStillCsrf(response);
          }
        }

        return response;
      },
    }),
  ],
});

// Re-export for use with React Query
export type TRPCClient = typeof trpcClient;
