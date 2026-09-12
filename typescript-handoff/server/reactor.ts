import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Session endpoint for the Reactor world.
 *
 * POST /reactor/session with an optional { model } body mints a session scoped token with the
 * Reactor API key and returns { token, model, expiresAt }. The key is read from REACTOR_API_KEY on
 * the server and never leaves this process. With REACTOR_MOCK=1, or when no key is present, the
 * endpoint answers with a fake token and mock true, which the client treats as a signal to fall
 * through to the fallback source, so the application runs with no key at all.
 */

const TOKEN_URL = 'https://api.reactor.inc/tokens';
const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000;

interface SessionResponse { token: string; model: string; expiresAt: string; mock?: boolean }

async function defaultModel(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const cfg = JSON.parse(await readFile(join(here, '..', 'reactor.config.json'), 'utf8')) as { defaultModel: string };
  return cfg.defaultModel;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => { let body = ''; req.on('data', (c: Buffer) => (body += c)); req.on('end', () => resolve(body)); });
}

function jwtExpiry(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    return payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
  } catch { return null; }
}

export async function mintSession(model: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<SessionResponse> {
  const key = env.REACTOR_API_KEY;
  if (env.REACTOR_MOCK === '1' || !key) {
    return { token: 'mock', model, expiresAt: new Date(Date.now() + 60_000).toISOString(), mock: true };
  }
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Reactor-API-Key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ authorization_details: [{ type: 'session', resources: { models: { match: [model] } }, constraints: { max_sessions: 2 } }] }),
  });
  if (!res.ok) throw new Error('reactor token endpoint answered ' + res.status);
  const { jwt } = (await res.json()) as { jwt: string };
  return { token: jwt, model, expiresAt: jwtExpiry(jwt) ?? new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString() };
}

/** Handles the /reactor routes on any Node http server. Returns false when the request is not for this module. */
export async function handleReactorRequest(req: IncomingMessage, res: ServerResponse, env: NodeJS.ProcessEnv): Promise<boolean> {
  const url = (req.url ?? '/').split('?')[0];
  if (url !== '/reactor/session') return false;
  const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { send(405, { error: 'method not allowed' }); return true; }
  try {
    const body = await readBody(req);
    const { model } = (body ? JSON.parse(body) : {}) as { model?: string };
    send(200, await mintSession(model || (await defaultModel()), env));
  } catch (e) {
    send(502, { error: e instanceof Error ? e.message : 'session failed' });
  }
  return true;
}

const entry = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entry) {
  const port = Number(process.env.PORT) || 8787;
  createServer((req, res) => { void handleReactorRequest(req, res, process.env).then((handled) => { if (!handled) { res.writeHead(404); res.end(); } }); }).listen(port, () => console.log('reactor session endpoint on ' + port + (process.env.REACTOR_API_KEY && process.env.REACTOR_MOCK !== '1' ? '' : ', mock mode')));
}
