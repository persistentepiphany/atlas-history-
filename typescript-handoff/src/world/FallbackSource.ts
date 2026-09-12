import type { Stop } from '../data/types';
import { awaitFirstFrame, makeVideo, type WorldSource } from './WorldSource';

/**
 * The linear fallback. It plays the rendered fallback video when one exists and per stop cuts
 * when a stop names a file. When no file plays within the swap window it resolves null and the
 * world plane carries the seed field with the same treatment, so the picture never goes empty.
 */
export class FallbackSource implements WorldSource {
  video: HTMLVideoElement | null = null;
  constructor(private url: string | null, private onElement?: (v: HTMLVideoElement) => void) {}
  async open() {
    if (!this.url) return null;
    const v = makeVideo(this.url, true); this.onElement?.(v);
    try { this.video = await awaitFirstFrame(v); return this.video; } catch { v.pause(); return null; }
  }
  async cut(stop: Stop) {
    if (!stop.video) return this.video;
    const v = makeVideo(stop.video, false); this.onElement?.(v);
    try { const next = await awaitFirstFrame(v); this.video?.pause(); this.video = next; return next; } catch { v.pause(); return this.video; }
  }
  async advance() { /* the fallback is linear and ignores prompts */ }
  close() { this.video?.pause(); this.video = null; }
}
