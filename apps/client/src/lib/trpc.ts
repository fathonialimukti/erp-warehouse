import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';

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
        return fetch(url, { ...options, credentials: 'include' });
      },
    }),
  ],
});

// Re-export for use with React Query
export type TRPCClient = typeof trpcClient;
