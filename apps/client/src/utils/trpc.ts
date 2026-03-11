import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../../server/src/router.ts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
})

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_TRPC_SERVER_URL
  if (envUrl) {
    return envUrl.replace(/\/$/, '')
  }

  return 'http://localhost:2022'
}

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      fetch(url: RequestInfo | URL, options?: RequestInit) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        })
      },
      // You can pass any HTTP headers you wish here
      async headers() {
        return {}
      },
    }),
  ],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
client: trpcClient,
queryClient,
})
