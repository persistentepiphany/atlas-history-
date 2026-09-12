import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/** Local stand in for the Reactor API. Returns a stream URL that never produces a frame and a fallback URL that does, so the 1500 ms swap is exercised on every run. Set REACTOR_LIVE=1 to point streamUrl at the fallback and exercise the live path. */
const sessions = new Map<string, { seedUrl: string; inputs: string[] }>();
const server = createServer((req, res) => {
  const url = req.url ?? '/'; const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.method === 'POST' && url === '/reactor/session') {
      const { seedUrl } = JSON.parse(body || '{}') as { seedUrl: string }; const id = randomUUID(); sessions.set(id, { seedUrl, inputs: [] });
      const fallbackUrl = seedUrl.includes('berlin1989') ? '/assets/events/berlin1989/video/r02.mp4' : '/assets/events/apollo11/video/r01.mp4';
      return send(200, { sessionId: id, streamUrl: process.env.REACTOR_LIVE ? fallbackUrl : '/reactor/stream/' + id, fallbackUrl });
    }
    const m = url.match(/^\/reactor\/session\/([^/]+)(\/input)?$/);
    if (m && m[2] && req.method === 'POST') { sessions.get(m[1]!)?.inputs.push((JSON.parse(body) as { prompt: string }).prompt); return send(200, { ok: true }); }
    if (m && req.method === 'DELETE') { sessions.delete(m[1]!); return send(200, { ok: true }); }
    if (url.startsWith('/reactor/stream/')) { res.writeHead(200, { 'content-type': 'video/mp4' }); return; }
    send(404, { error: 'not found' });
  });
});
server.listen(8787, () => console.log('mock reactor on 8787'));
