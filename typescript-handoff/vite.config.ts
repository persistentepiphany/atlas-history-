import { defineConfig, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { handleReactorRequest } from './server/reactor';

/** Serves the scenario contracts and the Reactor session endpoint from the dev server so the app runs on one port. Page, image, audio and video assets come from the walkthrough folder through publicDir, which honours range requests for video seeking. */
function api(): Plugin {
  return {
    name: 'atlas-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '/').split('?')[0]!;
        if (url.startsWith('/scenarios/') && url.endsWith('.json')) {
          try {
            const body = await readFile(join(process.cwd(), 'scenarios', url.slice('/scenarios/'.length)), 'utf8');
            res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(body); return;
          } catch { res.statusCode = 404; res.end('{}'); return; }
        }
        if (await handleReactorRequest(req, res, process.env)) return;
        next();
      });
    },
  };
}

/** The shader sources are imported as strings. */
function glsl(): Plugin {
  return { name: 'atlas-glsl', transform(code, id) { if (id.endsWith('.frag') || id.endsWith('.vert')) return { code: 'export default ' + JSON.stringify(code) + ';', map: null }; return null; } };
}

export default defineConfig({
  publicDir: '../walkthrough',
  plugins: [api(), glsl()],
  server: { port: 5173, strictPort: false, fs: { allow: ['..'] } },
  optimizeDeps: { exclude: ['@reactor-team/js-sdk'], include: ['react', 'react/jsx-runtime', 'react-dom/client', '@reactor-team/js-sdk > awaitqueue', '@reactor-team/js-sdk > mp4box', '@reactor-team/js-sdk > hls.js', '@reactor-team/js-sdk > react', '@reactor-team/js-sdk > react/jsx-runtime'] },
});
