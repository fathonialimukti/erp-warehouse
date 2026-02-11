import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { HeroUIProvider } from '@heroui/react';
import { TRPCProvider, makeQueryClient, makeTRPCClient } from './trpc';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { router } from './router';
import './index.css';

const queryClient = makeQueryClient();
const trpcClient = makeTRPCClient();

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <AuthProvider>
            <InnerApp />
          </AuthProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </HeroUIProvider>
  </React.StrictMode>,
);
