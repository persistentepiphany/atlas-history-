import { describe, expect, it } from 'vitest';
import { buildTracks, ease, initialValues, MIN_CUT, REDUCED_EASE, valueAt } from './beats';
import type { Scenario } from '../data/types';

const sc = {
  id: 'x', title: 'x', date: 'x', readPage: 'A', columnX: 0.5, lineHeight: 0.03,
  pages: { A: { src: 'a.png', x: 0, y: 0, w: 1, h: 1.4, label: 'A', source: 's', layer: 'deterministic', hub: true } },
  ghost: { src: 'g.png', x: 0, y: 0, w: 1, h: 1, label: 'g', source: 's', layer: 'generated' },
  world: { seed: null, label: 'w', source: 's', layer: 'generated', objective: 'o' },
  hubCamera: { x: 0.5, y: 0.7, z: 7 }, marks: [], align: {}, audio: {}, stops: [],
  beats: [
    { t: 0, phase: 'hub', ghost: { opacity: 0.32, scale: 1, dur: 0.3 } },
    { t: 10, phase: 'select', planes: { A: { o: 0, dur: 0.5 } } },
  ],
} as unknown as Scenario;

describe('tracks', () => {
  it('never keys a cut shorter than the minimum', () => {
    const tracks = buildTracks(sc);
    for (const keys of Object.values(tracks)) for (const k of keys) expect(k.dur).toBeGreaterThanOrEqual(MIN_CUT);
  });
  it('eases with the shared curve and no overshoot', () => {
    const tracks = buildTracks(sc); const init = initialValues(sc);
    const mid = valueAt(tracks, init, 'plane.A.o', 10 + MIN_CUT / 2);
    expect(mid).toBeCloseTo(1 - ease(0.5), 5); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1);
    expect(valueAt(tracks, init, 'plane.A.o', 10 + MIN_CUT + 1)).toBe(0);
    for (let x = 0; x <= 1; x += 0.05) { const y = ease(x); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(1); }
  });
  it('shortens every ease to 200 ms under reduced motion', () => {
    const tracks = buildTracks(sc); const init = initialValues(sc);
    expect(valueAt(tracks, init, 'plane.A.o', 10 + REDUCED_EASE, { reducedMotion: true })).toBe(0);
    expect(valueAt(tracks, init, 'plane.A.o', 10 + REDUCED_EASE, {})).toBeGreaterThan(0.5);
  });
});
