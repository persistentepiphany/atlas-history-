import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function reactorToken(key: string | undefined): Plugin {
  const wasmRoot = join(process.cwd(), 'node_modules', '@reactor-team', 'js-sdk', 'dist', 'wasm');
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.endsWith('/wasm/reactor_wasm.js')) { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(join(wasmRoot, 'reactor_wasm.js'))); return; }
    if (req.url?.endsWith('/wasm/reactor_wasm_bg.wasm')) { res.setHeader('content-type', 'application/wasm'); res.end(readFileSync(join(wasmRoot, 'reactor_wasm_bg.wasm'))); return; }
    if (req.url !== '/reactor/token' || req.method !== 'POST') return next();
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (!key) { res.statusCode = 503; res.end(JSON.stringify({ error: 'REACTOR_API_KEY is not configured' })); return; }
    try {
      const upstream = await fetch('https://api.reactor.inc/tokens', {
        method: 'POST', headers: { 'Reactor-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_details: [{ type: 'session', resources: { models: { match: ['reactor/helios'] } }, constraints: { max_sessions: 2, max_session_duration_seconds: 300 } }] }),
      });
      const body = await upstream.text(); res.statusCode = upstream.status; res.end(body);
    } catch (error) {
      res.statusCode = 502; res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Reactor unavailable' }));
    }
  };
  return {
    name: 'reactor-token', configureServer(server) { server.middlewares.use(handle); }, configurePreviewServer(server) { server.middlewares.use(handle); },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/wasm/reactor_wasm.js', source: readFileSync(join(wasmRoot, 'reactor_wasm.js')) });
      this.emitFile({ type: 'asset', fileName: 'assets/wasm/reactor_wasm_bg.wasm', source: readFileSync(join(wasmRoot, 'reactor_wasm_bg.wasm')) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './', publicDir: 'walkthrough', plugins: [react(), reactorToken(process.env.REACTOR_API_KEY || env.REACTOR_API_KEY)],
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
