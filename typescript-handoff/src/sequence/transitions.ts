import type { Phase, Scenario } from '../data/types';
import { ease, MIN_CUT } from './beats';

/** Near black. The veil never reaches full black so the page grain under it is still felt. */
export const VEIL_COLOUR = '#0b0b0a';
export const VEIL_HOLD = 0.6;
export const VEIL_RAMP = MIN_CUT;

export interface VeilWindow { t: number; from: Phase; to: Phase }

/** The phase boundaries that pass through the near black. Catalogue to hub is not on the timeline and is driven by the app. */
const DARK_BOUNDARIES: [Phase, Phase][] = [['hub', 'select'], ['world', 'return'], ['end', 'hub']];

export function veilWindows(sc: Scenario): VeilWindow[] {
  const out: VeilWindow[] = []; let prev: Phase = 'hub';
  for (const b of sc.beats) {
    if (b.phase !== prev && DARK_BOUNDARIES.some(([f, to]) => f === prev && to === b.phase)) out.push({ t: b.t, from: prev, to: b.phase });
    prev = b.phase;
  }
  return out;
}

/** Veil opacity at time t. Rises over a ramp, holds for VEIL_HOLD centred on the boundary, then falls over a ramp. */
export function veilAt(windows: VeilWindow[], t: number, reducedMotion = false): number {
  const ramp = reducedMotion ? 0.2 : VEIL_RAMP; const half = VEIL_HOLD / 2; let v = 0;
  for (const w of windows) {
    const up0 = w.t - half - ramp, up1 = w.t - half, dn0 = w.t + half, dn1 = w.t + half + ramp;
    if (t < up0 || t > dn1) continue;
    if (t < up1) v = Math.max(v, ease((t - up0) / ramp));
    else if (t <= dn0) v = 1;
    else v = Math.max(v, 1 - ease((t - dn0) / ramp));
  }
  return v;
}

/** A wall clock fade used for the catalogue transitions that are not on the timeline. */
export class ManualVeil {
  private from = 0; private to = 0; private t0 = 0; private dur = VEIL_RAMP;
  constructor(initial = 0) { this.from = initial; this.to = initial; }
  set(target: number, now: number, dur = VEIL_RAMP) { this.from = this.valueAt(now); this.to = target; this.t0 = now; this.dur = Math.max(0.05, dur); }
  valueAt(now: number) { const p = Math.min(1, Math.max(0, (now - this.t0) / this.dur)); return this.from + (this.to - this.from) * ease(p); }
  get target() { return this.to; }
}
