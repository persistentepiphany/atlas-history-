import type { Stop, WorldConfig } from '../data/types';
import { type WorldSource, type WorldStatus, makeVideoElement, waitForFrame, frameToDataUrl } from './WorldSource';
import { reactorConfig, worldAsset } from './config';

/**
 * Plays the scenario's pre-rendered fallback film. Stops map to the time offsets the pre-render
 * script wrote into world.fallbackOffsets, so advancing a stop seeks the film. Without offsets
 * the stops are spaced by their scenario times from the first stop. The film the scenario names is
 * tried first and its companion encoding beside it second, since a browser build without the
 * patented decoder can play only the second.
 */
export class FallbackSource implements WorldSource {
  readonly name = 'fallback';
  readonly element = makeVideoElement();
  status: WorldStatus = 'idle';
  private index = 0;
  private listeners: ((s: WorldStatus, reason?: string) => void)[] = [];
  private offsets: number[];

  constructor(private world: WorldConfig, private eventId: string) {
    const first = world.stops[0]?.t ?? 0;
    this.offsets = world.fallbackOffsets ?? world.stops.map((s) => s.t - first);
  }
  onStatus(cb: (s: WorldStatus, reason?: string) => void) { this.listeners.push(cb); }
  private set(s: WorldStatus, reason?: string) { if (this.status === 'failed') return; this.status = s; this.listeners.forEach((l) => l(s, reason)); }
  private fail(reason: string) { this.set('failed', reason); this.status = 'failed'; }

  private async seekAndPlay(i: number) {
    const v = this.element; const at = this.offsets[i] ?? 0;
    if (Math.abs(v.currentTime - at) > 0.2) v.currentTime = at;
    await v.play();
    await waitForFrame(v, reactorConfig.firstFrameTimeoutMs);
  }

  async prepare(stop: Stop) {
    try {
      this.set('connecting');
      this.index = Math.max(0, this.world.stops.indexOf(stop));
      const v = this.element; v.loop = false;
      const named = worldAsset(this.eventId, this.world.fallback);
      const candidates = [named, named.replace(/\.[^./]+$/, '.webm')].filter((u, i, a) => a.indexOf(u) === i);
      let last: Error | null = null;
      for (const url of candidates) {
        try { await this.open(url); last = null; break; }
        catch (e) { last = e instanceof Error ? e : new Error(String(e)); }
      }
      if (last) throw last;
      v.currentTime = this.offsets[this.index] ?? 0;
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }

  private open(url: string) {
    const v = this.element; v.src = url;
    return new Promise<void>((resolve, reject) => {
      if (v.readyState >= 1) return resolve();
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error('fallback film unplayable ' + url + (v.error ? ', ' + v.error.message : ''))); };
      const timer = setTimeout(bad, 8000);
      const cleanup = () => { clearTimeout(timer); v.removeEventListener('loadedmetadata', ok); v.removeEventListener('error', bad); };
      v.addEventListener('loadedmetadata', ok, { once: true });
      v.addEventListener('error', bad, { once: true });
    });
  }

  async enter(stop: Stop) {
    if (this.status === 'failed') throw new Error('source failed');
    try {
      const i = this.world.stops.indexOf(stop); if (i >= 0) this.index = i;
      await this.seekAndPlay(this.index);
      this.set('streaming');
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }

  async advance() { if (this.status === 'failed') throw new Error('source failed'); this.index += 1; this.element.currentTime = this.offsets[this.index] ?? this.element.currentTime; }
  captureFrame() { return frameToDataUrl(this.element); }
  pause() { this.element.pause(); }
  resume() { void this.element.play().catch(() => undefined); }
  look() { /* the film is baked, a look offset has nothing to steer */ }
  dispose() { this.element.pause(); this.element.removeAttribute('src'); this.element.load(); this.element.remove(); }
}
