import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { useAtomValue } from 'jotai';
import { AppProviders } from './providers';
import { router } from './routes';
import { useAuthBootstrap } from './lib/useAuth';
import { themeModeAtom } from './lib/atoms';

function ThemeSync() {
  const theme = useAtomValue(themeModeAtom);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

function AppContent() {
  useAuthBootstrap();

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AppProviders>
      <ThemeSync />
      <AppContent />
    </AppProviders>
  );
}
