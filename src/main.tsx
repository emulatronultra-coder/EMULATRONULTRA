// Polyfill Node globals for browser bundles
if (typeof window !== 'undefined') {
  (window as any).global = window;
  if (typeof (window as any).setImmediate === 'undefined') {
    (window as any).setImmediate = function (fn: (...args: any[]) => void, ...args: any[]) {
      return setTimeout(fn, 0, ...args);
    };
    (window as any).clearImmediate = function (id: any) {
      clearTimeout(id);
    };
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
