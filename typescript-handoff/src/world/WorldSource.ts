import type { Stop } from '../data/types';

/** A source of moving picture for the world. It resolves with a playing video element or null when only the seed field can be shown. */
export interface WorldSource {
  open(seedUrl: string): Promise<HTMLVideoElement | null>;
  /** A television or film cut for one stop. Returns the element now on screen, which may be unchanged. */
  cut(stop: Stop): Promise<HTMLVideoElement | null>;
  advance(prompt: string): Promise<void>;
  close(): void;
}
export const FIRST_FRAME_TIMEOUT_MS = 1500;

/** Resolves with the element once a frame is on screen, or rejects after the swap timeout. */
export function awaitFirstFrame(v: HTMLVideoElement, timeoutMs = FIRST_FRAME_TIMEOUT_MS): Promise<HTMLVideoElement> {
  const firstFrame = new Promise<HTMLVideoElement>((resolve) => {
    const done = () => resolve(v);
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(done);
    else v.addEventListener('playing', done, { once: true });
  });
  const failure = new Promise<never>((_, reject) => { v.addEventListener('error', () => reject(new Error('video failed')), { once: true }); setTimeout(() => reject(new Error('no frame')), timeoutMs); });
  void v.play().catch(() => undefined);
  return Promise.race([firstFrame, failure]);
}

export function makeVideo(src: string, loop: boolean): HTMLVideoElement {
  const v = document.createElement('video'); v.src = src; v.loop = loop; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto'; v.muted = false; v.volume = 1;
  return v;
}
