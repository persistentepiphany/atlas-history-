import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  publicDir: 'walkthrough',
  plugins: [react()],
  server: { proxy: { '/reactor': 'http://localhost:8787' } },
  preview: { proxy: { '/reactor': 'http://localhost:8787' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
