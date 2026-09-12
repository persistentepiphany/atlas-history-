import type { Scenario, Stop } from '../data/types';
import type { WorldSource, WorldStatus } from './WorldSource';
import { LiveReactorSource } from './LiveReactorSource';
import { FallbackSource } from './FallbackSource';
import { SeedSource } from './SeedSource';
import { reactorConfig } from './config';
import { applyTreatment } from './treatment';

export type WorldMode = 'auto' | 'live' | 'fallback' | 'seed' | 'prerender';

export interface WorldAudio {
  /** Fires an archive or narrator clip by id until the given scenario second. Unknown ids are ignored. */
  play(id: string, until: number): void;
  /** Routes a source element through the world bus, and lets the tail hang when the world closes. */
  attachWorld(el: HTMLVideoElement): void;
  releaseWorld(tailMs: number): void;
}

export interface OrchestratorDeps { audio?: WorldAudio; now: () => number; mode?: WorldMode }

export interface OrchestratorState { status: WorldStatus; source: string | null; stopIndex: number; lastFrame: string | null; reason: string | null; swaps: number; log: string[] }

/**
 * Owns the active world source, the swap between sources, the crossfade between stops, the audio
 * lead on every stop, the treatment grade and the last frame capture for the provenance mark. The
 * sequence layer calls door, world, enterStop and leave, and reads state for the overlays.
 */
export class WorldOrchestrator {
  readonly surface = document.createElement('div');
  private picture = document.createElement('div');
  private ghost = document.createElement('img');
  private source: WorldSource | null = null;
  private chain: (() => WorldSource)[] = [];
  private tier = 0;
  /** Raised while a call of this class is already handling a source, so a failure reported by the
   *  source is recovered once, by that call, rather than twice. */
  private guard = 0;
  private stops: Stop[];
  private state: OrchestratorState = { status: 'idle', source: null, stopIndex: -1, lastFrame: null, reason: null, swaps: 0, log: [] };
  private enteredAt = 0;
  private listeners = new Set<(s: OrchestratorState) => void>();
  private closed = false;
  private paused = false;

  constructor(private sc: Scenario, private deps: OrchestratorDeps) {
    this.stops = sc.world.stops;
    this.surface.className = 'world-surface'; this.picture.className = 'world-picture'; this.ghost.className = 'world-ghost';
    this.surface.append(this.picture, this.ghost, el('div', 'world-scanlines'), el('div', 'world-grain'), el('div', 'world-vignette'));
    this.surface.style.opacity = '0';
    applyTreatment(this.surface, sc.world.treatment);
    this.chain = this.buildChain(deps.mode ?? 'auto');
  }

  private buildChain(mode: WorldMode): (() => WorldSource)[] {
    const live = () => new LiveReactorSource(this.sc.world, this.sc.id);
    const fallback = () => new FallbackSource(this.sc.world, this.sc.id);
    const seed = () => new SeedSource(this.sc.world, this.sc.id);
    switch (mode) {
      case 'live': return [live, fallback, seed];
      case 'fallback': return [fallback, seed];
      case 'seed': return [seed];
      case 'prerender': return [live, seed];
      default: return reactorConfig.preferFallback ? [fallback, seed] : [live, fallback, seed];
    }
  }

  subscribe(cb: (s: OrchestratorState) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  getState() { return this.state; }
  private patch(p: Partial<OrchestratorState>) { const log = p.reason ? [...this.state.log, (this.state.source ?? 'none') + ': ' + p.reason] : this.state.log; this.state = { ...this.state, ...p, log }; this.listeners.forEach((l) => l(this.state)); }

  private mount(src: WorldSource) {
    this.picture.replaceChildren(src.element);
    src.onStatus((s, reason) => {
      if (src !== this.source) return;
      if (s !== 'failed') { this.patch({ status: s }); return; }
      if (this.guard > 0) { this.patch({ reason: reason ?? 'failed' }); return; }
      void this.swap(reason ?? 'failed');
    });
    this.deps.audio?.attachWorld(src.element);
    this.patch({ source: src.name, status: src.status });
  }

  private currentStop(): Stop | null { return this.stops[Math.max(0, this.state.stopIndex)] ?? null; }

  /** The next source down the chain. The last entry is the floor and is handed out again rather than
   *  running out, so a world that has lost its picture can always be rebuilt. */
  private nextSource(): WorldSource | null {
    const make = this.chain[Math.min(this.tier, this.chain.length - 1)];
    if (!make) return null;
    this.tier = Math.min(this.tier + 1, this.chain.length);
    return make();
  }
  private get exhausted() { return this.tier >= this.chain.length; }

  /** Builds the next source in the chain and brings it to the current stop. Called on any failure. */
  private swapping: Promise<void> | null = null;
  private swap(reason: string): Promise<void> {
    if (this.swapping) return this.swapping;
    this.swapping = (async () => {
      this.guard += 1;
      const old = this.source; this.source = null;
      await this.showGhost();
      old?.dispose();
      this.patch({ reason, swaps: this.state.swaps + 1 });
      let tries = this.chain.length + 1;
      while (tries-- > 0) {
        const next = this.nextSource(); if (!next) break;
        try {
          const stop = this.currentStop() ?? this.stops[0];
          if (!stop) break;
          this.source = next; this.mount(next);
          await next.prepare(stop);
          if (this.state.stopIndex >= 0) await next.enter(stop);
          this.hideGhost();
          this.guard -= 1; this.swapping = null;
          return;
        } catch (e) {
          this.source = null; next.dispose();
          this.patch({ reason: e instanceof Error ? e.message : String(e) });
        }
      }
      this.patch({ status: 'failed', source: null });
      this.guard -= 1; this.swapping = null;
    })();
    return this.swapping;
  }

  private async showGhost() {
    const frame = this.source ? await this.source.captureFrame() : null;
    if (!frame) return;
    this.ghost.src = frame; this.ghost.style.transition = 'none'; this.ghost.style.opacity = '1';
    this.patch({ lastFrame: frame });
  }
  private hideGhost() {
    requestAnimationFrame(() => { this.ghost.style.transition = 'opacity ' + reactorConfig.stopCrossfadeMs + 'ms ease'; this.ghost.style.opacity = '0'; });
  }

  /** Door entry. Mints the session and seeds the first stop with the surface still hidden. */
  async door() {
    if (this.source || this.closed) return;
    const first = this.stops[0]; if (!first) return;
    this.guard += 1;
    try {
      while (!this.exhausted) {
        const src = this.nextSource(); if (!src) break;
        try { this.source = src; this.mount(src); await src.prepare(first); return; }
        catch (e) { this.source = null; src.dispose(); this.patch({ reason: e instanceof Error ? e.message : String(e), swaps: this.state.swaps + 1 }); }
      }
      this.patch({ status: 'failed', source: null });
    } finally { this.guard -= 1; }
  }

  /** World entry. The surface fades with the world mix track, which the sequence sets through setMix. */
  world() { this.surface.style.visibility = 'visible'; }
  setMix(v: number) { this.surface.style.opacity = String(Math.max(0, Math.min(1, v))); }

  /** Enters stop i. Audio fires first, the picture follows after the audio lead, and any move past the current stop re-seeds the source under a crossfade. */
  async enterStop(i: number) {
    const stop = this.stops[i]; if (!stop || this.closed) return;
    const until = (this.stops[i + 1]?.t ?? stop.t + 12) - 0.3;
    if (stop.archive) this.deps.audio?.play(stop.archive, until);
    if (stop.voice) this.deps.audio?.play(stop.voice, until);
    await sleep(reactorConfig.audioLeadMs);
    if (this.closed) return;
    const from = this.state.stopIndex;
    this.patch({ stopIndex: i });
    if (!this.source) { await this.swap('no source at stop ' + i); return; }
    this.guard += 1;
    try {
      if (i > from && from >= 0) {
        await this.showGhost();
        for (let k = from; k < i; k++) await this.source.advance();
      }
      await this.source.enter(stop);
      this.hideGhost();
      this.enteredAt = performance.now();
    } catch (e) { this.guard -= 1; await this.swap(e instanceof Error ? e.message : String(e)); return; }
    this.guard -= 1;
  }

  /** The stop can be advanced once its hold has elapsed. */
  canAdvance() { const s = this.currentStop(); if (!s || this.state.stopIndex < 0) return true; return performance.now() - this.enteredAt >= (s.hold ?? 0) * 1000; }

  pause() { if (!this.paused) { this.paused = true; this.source?.pause(); } }
  resume() { if (this.paused) { this.paused = false; this.source?.resume(); } }

  /** The only free input, a look offset clamped to maxLookOffset. */
  look(dx: number, dy: number) { const m = reactorConfig.maxLookOffset; this.source?.look(clamp(dx, m), clamp(dy, m)); }

  /** Return beat. Captures the last frame for the provenance mark, lets the reverb tail hang, then disposes. */
  async leave() {
    if (this.closed) return; this.closed = true;
    const stop = this.currentStop();
    if (this.source && (stop?.captureFrame ?? true)) { const frame = await this.source.captureFrame(); if (frame) this.patch({ lastFrame: frame }); }
    this.deps.audio?.releaseWorld(reactorConfig.returnTailMs);
    const src = this.source; this.source = null;
    setTimeout(() => src?.dispose(), reactorConfig.stopCrossfadeMs + reactorConfig.returnTailMs);
  }

  dispose() { this.closed = true; this.source?.dispose(); this.source = null; this.surface.remove(); }
}

function el(tag: string, cls: string) { const e = document.createElement(tag); e.className = cls; return e; }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
function clamp(v: number, m: number) { return Math.max(-m, Math.min(m, v)); }
