import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "./trpc.js";

/**
 * Whether this deployment actually offers demo sign-in.
 *
 * `auth.demoUsers` is a public procedure that returns `[]` when the server's
 * `DEMO_LOGIN_ENABLED` is not `"true"`, so the same list the login page uses to
 * render its "Login as X" cards doubles as the single source of truth for
 * whether advertising a demo credential is honest. A deployment with demo off
 * must not print a credential on the landing page.
 *
 * `false` while loading and on error, so the marketing copy never flashes a
 * credential that may turn out to be disabled.
 */
export function useDemoLoginEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["auth", "demoUsers"],
    queryFn: () => trpcClient.auth.demoUsers.query(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (data?.length ?? 0) > 0;
}
