import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';

// In dev, Vite proxies /trpc to the server (relative URL works).
// In production behind an nginx proxy on a separate subdomain, set
// VITE_TRPC_URL to the full API origin (e.g. https://api.yourdomain.com).
const trpcBaseUrl = import.meta.env.VITE_TRPC_URL ?? '';

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
