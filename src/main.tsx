import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './fonts';
import './index.css';
import { useStore } from './store/useStore';

// Ask the browser not to evict saved progress (mobile Safari clears idle sites).
void navigator.storage?.persist?.().catch(() => {});

if (import.meta.env.DEV) (window as unknown as { __ws: typeof useStore }).__ws = useStore;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
