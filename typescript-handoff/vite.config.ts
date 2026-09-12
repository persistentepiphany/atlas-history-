import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The application serves the reviewed walkthrough folder as its public root so the
 * catalogue, the scenario files and the event assets are shared with the static piece.
 * The mock Reactor endpoint is proxied from its own port during development.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: resolve(__dirname, '../walkthrough'),
  server: { port: 5173, proxy: { '/reactor': 'http://localhost:8787' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1600 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
