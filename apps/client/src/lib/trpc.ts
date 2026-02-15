import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink as vanillaHttpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../../server/src/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
        },
    },
});

const getHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const trpcClient = trpc.createClient({
    links: [
        httpBatchLink({
            url: import.meta.env.VITE_TRPC_URL || "http://localhost:2022/trpc",
            headers: getHeaders,
        }),
    ],
});

// Vanilla client for use outside React components
export const trpcVanilla = createTRPCClient<AppRouter>({
    links: [
        vanillaHttpBatchLink({
            url: import.meta.env.VITE_TRPC_URL || "http://localhost:2022/trpc",
            headers: getHeaders,
        }),
    ],
});
