import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { trpc, trpcClient, queryClient } from './lib/trpc';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </trpc.Provider>
  </React.StrictMode>,
);
