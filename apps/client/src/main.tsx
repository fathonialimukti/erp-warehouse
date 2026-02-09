import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTheme, MantineProvider } from '@mantine/core';
import App from './App';
import { TRPCProvider, makeQueryClient, makeTRPCClient } from './trpc';
import { AuthProvider } from './auth/AuthContext';
import '@mantine/core/styles.css';

const queryClient = makeQueryClient();
const trpcClient = makeTRPCClient();

const theme = createTheme({
  /** Put your mantine theme override here */
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
