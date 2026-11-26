import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import { toast } from "@heroui/react";
import { AppProviders } from "./providers";
import { router, MARKETING_ONLY } from "./routes";
import { useAuthBootstrap } from "./lib/useAuth";
import { themeModeAtom } from "./lib/atoms";
import { initCsrf, onCsrfFailure } from "./lib/csrf";

function ThemeSync() {
  const theme = useAtomValue(themeModeAtom);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}

/** Full app only: auth bootstrap + CSRF handshake. Never mounted in marketing. */
function SessionBootstrap() {
  useAuthBootstrap();
  useEffect(() => {
    void initCsrf();
  }, []);
  return <CsrfFailureToast />;
}

function AppContent() {
  // The marketing-only build has no session, so it mounts neither the auth
  // bootstrap nor the CSRF handshake: a public page never calls `/trpc` or
  // `/api` (and never logs errors when there is no backend).
  return (
    <>
      {!MARKETING_ONLY && <SessionBootstrap />}
      <RouterProvider router={router} />
    </>
  );
}

/**
 * Turns a post-retry CSRF failure into a visible HeroUI toast.
 * A failed refresh + single retry means the session is unusable — the user
 * must see that (reload prompt), never a silently dead app.
 */
function CsrfFailureToast() {
  const intl = useIntl();
  useEffect(
    () =>
      onCsrfFailure(() => {
        toast.danger(
          intl.formatMessage({
            id: "common.csrf.refresh_failed",
            defaultMessage:
              "Your session expired. Reload the page and try again.",
          }),
        );
      }),
    [intl],
  );
  return null;
}

function App() {
  return (
    <AppProviders>
      <ThemeSync />
      <AppContent />
    </AppProviders>
  );
}

export { App };
