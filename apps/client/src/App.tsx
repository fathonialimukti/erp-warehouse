import { RouterProvider } from 'react-router';
import { AppProviders } from './providers';
import { router } from './routes';
import { useAuthBootstrap } from './lib/useAuth';

function AppContent() {
  useAuthBootstrap();

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
