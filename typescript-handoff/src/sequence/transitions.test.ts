import { describe, expect, it } from 'vitest';
import { ManualVeil, VEIL_HOLD, VEIL_RAMP, veilAt, veilWindows } from './transitions';
import type { Scenario } from '../data/types';

const sc = { beats: [
  { t: 0, phase: 'hub' }, { t: 8, phase: 'select' }, { t: 14, phase: 'read' }, { t: 90, phase: 'world' }, { t: 145, phase: 'return' }, { t: 175, phase: 'end' }, { t: 180, phase: 'hub' },
] } as unknown as Scenario;

describe('veil', () => {
  it('finds the boundaries that pass through the near black', () => {
    expect(veilWindows(sc).map((w) => w.t)).toEqual([8, 145, 180]);
  });
  it('holds for 0.6 s centred on the boundary and ramps over the minimum cut on each side', () => {
    const w = veilWindows(sc);
    expect(veilAt(w, 8)).toBe(1); expect(veilAt(w, 8 - VEIL_HOLD / 2)).toBe(1); expect(veilAt(w, 8 + VEIL_HOLD / 2)).toBe(1);
    expect(veilAt(w, 8 - VEIL_HOLD / 2 - VEIL_RAMP)).toBeCloseTo(0, 6); expect(veilAt(w, 8 + VEIL_HOLD / 2 + VEIL_RAMP)).toBeCloseTo(0, 6);
    const half = veilAt(w, 8 - VEIL_HOLD / 2 - VEIL_RAMP / 2); expect(half).toBeGreaterThan(0.3); expect(half).toBeLessThan(0.7);
    expect(veilAt(w, 50)).toBe(0);
  });
  it('fades a manual veil on the wall clock', () => {
    const v = new ManualVeil(1); v.set(0, 10, 1.2);
    expect(v.valueAt(10)).toBe(1); expect(v.valueAt(11.2)).toBeCloseTo(0, 6); expect(v.valueAt(10.6)).toBeGreaterThan(0); expect(v.valueAt(10.6)).toBeLessThan(1);
  });
});
