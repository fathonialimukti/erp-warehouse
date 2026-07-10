import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';

// Uses relative URL — Vite proxies /trpc to the server in dev,
// and in production the client and server are served from the same origin.
const trpcBaseUrl = '';

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
