import { createTRPCContext } from "@trpc/tanstack-react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../server/src/router";

const trpcUrl = import.meta.env.VITE_TRPC_URL ?? "http://localhost:2022";

// Create tRPC context with type-safe hooks
export const { TRPCProvider, useTRPC, useTRPCClient } =
    createTRPCContext<AppRouter>();

// Factory function to create QueryClient
export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // 5 minutes
            },
        },
    });
}

// Factory function to create tRPC client
export function makeTRPCClient() {
    return createTRPCClient<AppRouter>({
        links: [httpBatchLink({ url: trpcUrl })],
    });
}
