import { describe, expect, it } from 'vitest';
import { MasterClock } from './clock';

function fakeVoice(): HTMLMediaElement { return { currentTime: 0, paused: false, ended: false, error: null, duration: 10 } as unknown as HTMLMediaElement; }

describe('master clock', () => {
  it('accumulates frame time while no voice plays', () => {
    const c = new MasterClock(); c.tick(0.5); c.tick(0.25); expect(c.time).toBeCloseTo(0.75);
  });
  it('follows the voice element while it plays and resyncs at each start', () => {
    const c = new MasterClock(); c.tick(2); const el = fakeVoice(); c.attachVoice(el, 8);
    expect(c.time).toBe(8); el.currentTime = 1.5; expect(c.time).toBe(9.5);
    (el as { ended: boolean }).ended = true; c.tick(0.1); expect(c.time).toBeCloseTo(9.6);
  });
  it('pauses both and seeks both', () => {
    const c = new MasterClock(); const el = fakeVoice(); c.attachVoice(el, 8); c.paused = true; c.tick(1); expect(c.time).toBe(8);
    c.paused = false; c.seek(12); expect(el.currentTime).toBe(4); expect(c.time).toBe(12);
    c.seek(30); expect(c.voiceElement).toBeNull(); expect(c.time).toBe(30);
  });
});
