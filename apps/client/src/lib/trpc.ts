import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';
import { getCsrfToken } from './csrf.js';

// In dev, use Vite proxy (relative URL = same-origin, no CORS).
// In production, use VITE_TRPC_URL or the production subdomain.
const trpcBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_TRPC_URL ?? 'https://erp-warehouse-api.aetherglo.com');

export type AppRouterType = AppRouter;

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

        return fetch(url, { ...options, headers, credentials: 'include' });
      },
    }),
  ],
});

// Re-export for use with React Query
export type TRPCClient = typeof trpcClient;
