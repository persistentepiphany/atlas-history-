import type { Scenario } from './types';
import { clipSrc } from './types';

export interface PreloadReport { images: string[]; audio: string[]; failed: string[] }

function loadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => { const im = new Image(); im.decoding = 'async'; im.onload = () => resolve(true); im.onerror = () => resolve(false); im.src = src; });
}
function loadAudio(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('audio'); el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    el.addEventListener('canplaythrough', () => done(true), { once: true }); el.addEventListener('error', () => done(false), { once: true });
    el.src = src; el.load();
  });
}

/** The urls a sequence needs before the begin prompt may appear. Pages, the photo crop, ghost frames, the seed and the first voice or archive clip. */
export function preloadList(sc: Scenario, base = '/'): { images: string[]; audio: string[] } {
  const images = new Set<string>();
  for (const p of Object.values(sc.pages)) images.add(base + p.src);
  images.add(base + sc.ghost.src);
  for (const b of sc.beats) if (b.ghost?.src) images.add(base + b.ghost.src);
  if (sc.world.seed) images.add(base + sc.world.seed);
  const audio = new Set<string>();
  const firstVoice = sc.beats.map((b) => b.voice?.id).find((id) => id && sc.audio[id]);
  if (firstVoice) audio.add(resolveClip(base, clipSrc(sc.audio[firstVoice]!)));
  const firstArchive = sc.beats.flatMap((b) => b.archive ?? []).map((a) => a.id).find((id) => sc.audio[id]);
  if (firstArchive) audio.add(resolveClip(base, clipSrc(sc.audio[firstArchive]!)));
  return { images: [...images], audio: [...audio] };
}

export function resolveClip(base: string, src: string) { return /^https?:/.test(src) ? src : base + src; }

/** Resolves when every listed asset is decoded or has failed. Nothing stutters on the first push because the textures are already in cache. */
export async function preload(sc: Scenario, base = '/', audioTimeoutMs = 20000): Promise<PreloadReport> {
  const list = preloadList(sc, base); const failed: string[] = [];
  await Promise.all([
    ...list.images.map(async (u) => { if (!(await loadImage(u))) failed.push(u); }),
    ...list.audio.map(async (u) => { if (!(await loadAudio(u, audioTimeoutMs))) failed.push(u); }),
  ]);
  return { images: list.images, audio: list.audio, failed };
}
