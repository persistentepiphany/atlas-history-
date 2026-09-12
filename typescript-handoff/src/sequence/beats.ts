import type { Beat, Scenario, Phase } from '../data/types';

export interface Key { t: number; v: number; dur: number }
export type Tracks = Record<string, Key[]>;

/** No cut on picture is ever shorter than this. Every keyed value eases over at least 1.2 s. */
export const MIN_CUT = 1.2;
/** Under a reduced motion preference every ease collapses to 200 ms. */
export const REDUCED_EASE = 0.2;

export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a, B = (a: number, b: number) => 3 * b - 6 * a, C = (a: number) => 3 * a;
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t: number, a: number, b: number) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (x: number) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 6; i++) { const s = slope(t, x1, x2); if (s === 0) break; t -= (calc(t, x1, x2) - x) / s; } return calc(t, y1, y2); };
}
/** The one shared curve. It has no overshoot, so a camera move never passes its target and comes back. */
export const ease = bezier(0.65, 0, 0.35, 1);

export function initialValues(sc: Scenario): Record<string, number> {
  const hub = sc.hubCamera;
  const init: Record<string, number> = { 'camera.x': hub.x, 'camera.y': hub.y, 'camera.z': hub.z, 'focus.x': hub.x, 'focus.y': hub.y, 'focus.radius': 1, 'post.grain': 0.04, 'post.vignette': 0.15, 'post.aberration': 0, warmth: 0, letterbox: 0, desat: 0, 'ghost.opacity': 0, 'ghost.scale': 1.05, 'world.mix': 0, bed: 0 };
  for (const [id, p] of Object.entries(sc.pages)) { init['plane.' + id + '.o'] = p.hub ? 1 : 0; init['plane.' + id + '.slide'] = p.slideFrom != null ? 0 : 1; }
  return init;
}

export function buildTracks(sc: Scenario): Tracks {
  const tracks: Tracks = {};
  const add = (name: string, t: number, v: number, dur: number | undefined) => { (tracks[name] ??= []).push({ t, v, dur: Math.max(dur ?? 1.5, MIN_CUT) }); };
  const grab = (b: Beat, obj: Record<string, number | undefined> | undefined, keys: string[], prefix: string, ddur: number) => {
    if (!obj) return; for (const k of keys) { const v = obj[k]; if (v != null) add(prefix + k, obj.at ?? b.t, v, obj.dur ?? ddur); }
  };
  for (const b of sc.beats) {
    grab(b, b.camera as Record<string, number | undefined>, ['x', 'y', 'z'], 'camera.', 2);
    grab(b, b.focus as Record<string, number | undefined>, ['x', 'y', 'radius'], 'focus.', 1.5);
    grab(b, b.post as Record<string, number | undefined>, ['grain', 'vignette', 'aberration'], 'post.', 1.5);
    if (b.warmth) add('warmth', b.warmth.at ?? b.t, b.warmth.v, b.warmth.dur ?? 2);
    if (b.letterbox) add('letterbox', b.letterbox.at ?? b.t, b.letterbox.v, b.letterbox.dur ?? 1.2);
    if (b.desat) add('desat', b.desat.at ?? b.t, b.desat.v, b.desat.dur ?? 1.2);
    if (b.bed) add('bed', b.bed.at ?? b.t, b.bed.v, b.bed.dur ?? 2);
    grab(b, b.ghost as Record<string, number | undefined>, ['opacity', 'scale'], 'ghost.', 1.2);
    if (b.world) add('world.mix', b.world.at ?? b.t, b.world.mix, b.world.dur ?? 2);
    for (const [id, pl] of Object.entries(b.planes ?? {})) { if (pl.o != null) add('plane.' + id + '.o', pl.at ?? b.t, pl.o, pl.dur); if (pl.slide != null) add('plane.' + id + '.slide', pl.at ?? b.t, pl.slide, pl.dur); }
  }
  for (const keys of Object.values(tracks)) keys.sort((a, b) => a.t - b.t);
  return tracks;
}

export interface SampleOptions { base?: { t: number; v: number }; reducedMotion?: boolean }

/** Samples one track at time t. A base overrides the start of the next key so a tracked camera can hand back to the sheet without a jump. */
export function valueAt(tracks: Tracks, init: Record<string, number>, name: string, t: number, opts: SampleOptions = {}) {
  const { base, reducedMotion } = opts;
  let v = init[name] ?? 0; let usedBase = false;
  for (const k of tracks[name] ?? []) {
    if (k.t > t) break; let from = v; if (base && !usedBase && k.t >= base.t) { from = base.v; usedBase = true; }
    const dur = reducedMotion ? Math.min(k.dur, REDUCED_EASE) : k.dur;
    const p = Math.min(1, Math.max(0, (t - k.t) / dur)); v = from + (k.v - from) * ease(p);
  }
  if (base && !usedBase && t >= base.t) return base.v;
  return v;
}

export function phaseAt(sc: Scenario, t: number): Phase { let ph: Phase = 'hub'; for (const b of sc.beats) { if (b.t <= t) ph = b.phase; else break; } return ph; }
export function beatAt(sc: Scenario, t: number): Beat | undefined { let cur: Beat | undefined; for (const b of sc.beats) { if (b.t <= t) cur = b; else break; } return cur; }
export function nextBeatAfter(sc: Scenario, t: number): Beat | undefined { return sc.beats.find((b) => b.t > t); }

/** Holds drift by 0.004 units. Disabled under reduced motion. */
export function drift(t: number, reducedMotion = false) { if (reducedMotion) return { x: 0, y: 0 }; return { x: 0.004 * Math.sin(t * 0.5), y: 0.004 * Math.cos(t * 0.33) }; }
