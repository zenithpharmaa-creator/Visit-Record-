import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';

// Ensure all API calls in native Android Capacitor point to the Cloud backend server
if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const serverUrl = localStorage.getItem('fvt_backend_server_url') || 'https://ais-dev-gg2b2vz3woxxeevhjzru3w-53432909942.europe-west2.run.app';
      return originalFetch(`${serverUrl}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(<App />);
