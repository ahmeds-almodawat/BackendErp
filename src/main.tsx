import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TRPCProvider } from './providers/trpc';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary title="ERP platform failed to load" moduleName="root" storageKey="restaurant-erp-v301-supabase-cutover-foundation">
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
