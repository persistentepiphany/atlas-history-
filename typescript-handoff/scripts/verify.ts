import { createServer } from 'vite';
import { chromium, type Page } from 'playwright';
import { readFile } from 'node:fs/promises';

/**
 * Plays each listed event end to end through the world and checks the source, the stop
 * progression and the return capture. A second pass kills the network in the middle of the
 * world and checks that the orchestrator swaps to the next source without stopping. Runs
 * headless against the dev server. Usage: npm run verify [-- apollo11 _template] [--live]
 */
const args = process.argv.slice(2);
const live = args.includes('--live');
const events = args.filter((a) => !a.startsWith('--'));
const ids = events.length ? events : (JSON.parse(await readFile('scenarios/index.json', 'utf8')) as { events: string[] }).events;

const server = await createServer({ configFile: 'vite.config.ts', server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const base = 'http://localhost:5198';
const browser = await chromium.launch({ executablePath: process.env.PRERENDER_BROWSER || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures += 1; };

interface Snapshot { phase: string; t: number; running: boolean; world: { status: string; source: string | null; stopIndex: number; lastFrame: string | null; reason: string | null; swaps: number; log: string[] } | null }
const snap = (page: Page) => page.evaluate(() => window.__atlas as unknown as Snapshot);

for (const id of ids) {
  const sc = JSON.parse(await readFile('scenarios/' + id + '.json', 'utf8')) as { beats: { t: number; phase: string }[]; world: { stops: { t: number; label: string }[] } };
  const door = sc.beats.find((b) => b.phase === 'door')!.t; const ret = sc.beats.find((b) => b.phase === 'return')!.t;
  console.log(id + (live ? ' live chain' : ' fallback chain'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('  [page] ' + m.text().slice(0, 300)); }); page.on('response', (r) => { if (r.status() >= 400) console.log('  [' + r.status() + '] ' + r.url()); });
  await page.goto(base + '/?event=' + id + '&autostart=1&debug=1&speed=3&at=' + (door - 1) + (live ? '&live=1' : '&live=0'));
  await page.waitForFunction(() => window.__atlas?.phase === 'world', null, { timeout: 60_000 });
  const seen = new Set<number>(); let s = await snap(page);
  while (s.phase === 'world' || s.t < ret + 1) { s = await snap(page); if (s.world && s.world.stopIndex >= 0) seen.add(s.world.stopIndex); if (s.t > ret + 2) break; await page.waitForTimeout(250); }
  check(seen.size === sc.world.stops.length, 'entered every stop ' + [...seen].join(' ') + ' of ' + sc.world.stops.length);
  check(!!s.world && s.world.status !== 'failed', 'world status ' + s.world?.status + ' on ' + s.world?.source + (s.world?.reason ? ' after ' + s.world.reason : ''));
  check(!!s.world?.lastFrame, 'last frame captured for the provenance mark');
  if (s.world?.log.length) console.log('  log: ' + s.world.log.join(' / '));
  check(errors.length === 0, 'no page errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
  await context.close();

  console.log(id + ' network killed mid world');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p2 = await ctx2.newPage();
  await p2.goto(base + '/?event=' + id + '&autostart=1&debug=1&speed=3&at=' + (door - 1) + (live ? '&live=1' : '&live=0'));
  await p2.waitForFunction(() => (window.__atlas?.world?.stopIndex ?? -1) >= 0, null, { timeout: 60_000 });
  const before = await snap(p2);
  await ctx2.setOffline(true);
  await p2.route('**/*', (r) => r.abort());
  await p2.waitForFunction((n) => (window.__atlas?.world?.stopIndex ?? -1) >= n, before.world!.stopIndex + 1, { timeout: 60_000 }).catch(() => undefined);
  await p2.waitForTimeout(2500);
  const after = await snap(p2);
  check(!!after.world && after.world.status !== 'failed', 'still ' + after.world?.status + ' on ' + after.world?.source + ' after the network went away, swaps ' + after.world?.swaps + (after.world?.reason ? ', last reason ' + after.world.reason : ''));
  if (after.world?.log.length) console.log('  log: ' + after.world.log.join(' / '));
  await ctx2.close();
}
await browser.close(); await server.close();
console.log(failures ? failures + ' failures' : 'all checks passed');
process.exit(failures ? 1 : 0);
