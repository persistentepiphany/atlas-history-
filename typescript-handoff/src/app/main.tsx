import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const params = new URLSearchParams(location.search);
if (params.get('prerender') === '1') {
  const { runPrerender } = await import('../world/prerender');
  void runPrerender(params);
} else {
  if (params.get('studio') === '1') {
    const studio = (await import('@theatre/studio')).default; const extension = (await import('@theatre/r3f/dist/extension')).default; studio.extend(extension); studio.initialize();
  }
  const { App } = await import('./App');
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
