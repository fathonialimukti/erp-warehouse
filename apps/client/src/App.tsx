import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { toast } from '@heroui/react';
import { AppProviders } from './providers';
import { router } from './routes';
import { useAuthBootstrap } from './lib/useAuth';
import { themeModeAtom } from './lib/atoms';
import { initCsrf, onCsrfFailure } from './lib/csrf';

function ThemeSync() {
  const theme = useAtomValue(themeModeAtom);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

function AppContent() {
  useAuthBootstrap();
  useEffect(() => {
    void initCsrf();
  }, []);

  return (
    <>
      <CsrfFailureToast />
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
            id: 'common.csrf.refresh_failed',
            defaultMessage: 'Your session expired. Reload the page and try again.',
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
