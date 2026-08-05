import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';

// In dev, Vite proxies /trpc to the server (relative URL works).
// In production the API runs on a separate subdomain — set VITE_TRPC_URL
// when building for deployment.
const trpcBaseUrl = import.meta.env.VITE_TRPC_URL ?? 'https://erp-warehouse-api.aetherglo.com';

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
