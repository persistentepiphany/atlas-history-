import { createServer } from 'vite';
import { chromium } from 'playwright';
import { execa } from 'execa';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Records each event's world to its fallback film and writes the stop offsets back into the
 * scenario. Two encodings of the same recording are written, the H.264 file the scenario names and a
 * VP9 companion beside it, because a browser build without the patented decoder can play only the
 * second, and the fallback source tries them in that order. The app is opened with ?prerender=1&event=<id>, which runs the live source through
 * every stop on the scenario's own timer while Playwright records the viewport. The recording is
 * trimmed to the first frame of the first stop with blackdetect and encoded to H.264. The seed
 * source stands in when the live model is unreachable, so the film always exists and always
 * matches the stop times, and it is regenerated from the live model by rerunning this script
 * with a key present.
 *
 * Usage: npm run prerender [-- apollo11 berlin1989] [--mode=seed]
 */
const args = process.argv.slice(2);
const mode = args.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'live';
const events = args.filter((a) => !a.startsWith('--'));
const ids = events.length ? events : (JSON.parse(await readFile('scenarios/index.json', 'utf8')) as { events: string[] }).events;
const SIZE = { width: 1280, height: 720 };
const ffmpeg = ffmpegInstaller.path;

const server = await createServer({ configFile: 'vite.config.ts', server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const base = 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: process.env.PRERENDER_BROWSER || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function firstFrame(file: string): Promise<number> {
  const { stderr } = await execa(ffmpeg, ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.05:pix_th=0.08', '-an', '-f', 'null', '-'], { reject: false });
  const m = stderr.match(/black_start:0(?:\.\d+)? black_end:([\d.]+)/);
  return m ? Number(m[1]) : 0;
}

for (const id of ids) {
  const scenarioPath = join('scenarios', id + '.json');
  const sc = JSON.parse(await readFile(scenarioPath, 'utf8')) as { world: { fallback: string; fallbackOffsets?: number[]; stops: { t: number }[] } };
  const dir = await mkdtemp(join(tmpdir(), 'atlas-prerender-'));
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page] ' + m.text()); });
  await page.goto(base + '/?prerender=1&event=' + id + '&mode=' + mode);
  await page.waitForFunction(() => window.__atlasPrerender?.done === true, null, { timeout: 15 * 60 * 1000 });
  const report = await page.evaluate(() => window.__atlasPrerender!);
  const video = page.video(); await context.close();
  if (!video) throw new Error('no recording for ' + id);
  const webm = await video.path();
  if (report.error) throw new Error(id + ' ' + report.error);
  const start = await firstFrame(webm);
  const out = join('..', 'walkthrough', 'assets', id, sc.world.fallback);
  await mkdir(join(out, '..'), { recursive: true });
  await execa(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', start.toFixed(3), '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  const companion = out.replace(/\.[^.]+$/, '.webm');
  await execa(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', start.toFixed(3), '-i', webm, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-speed', '3', '-pix_fmt', 'yuv420p', companion]);
  const t0 = report.entries[0] ?? 0;
  const offsets = report.entries.map((e) => Math.round((e - t0) * 1000) / 1_000_000);
  const raw = JSON.parse(await readFile(scenarioPath, 'utf8')) as { world: Record<string, unknown> };
  const world: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.world)) { if (k === 'fallbackOffsets') continue; world[k] = v; if (k === 'fallback') world.fallbackOffsets = offsets; }
  raw.world = world;
  await writeFile(scenarioPath, JSON.stringify(raw, null, 1) + '\n');
  await rm(dir, { recursive: true, force: true });
  console.log(id + ': ' + out + ' and ' + companion + ' from ' + report.sources.join(', ') + ' offsets ' + offsets.join(' ') + (report.reason ? ' (' + report.reason + ')' : ''));
}
await browser.close();
await server.close();
