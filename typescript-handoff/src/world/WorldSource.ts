import type { Stop } from '../data/types';

export type WorldStatus = 'idle' | 'connecting' | 'streaming' | 'failed';

/** A pose step in the model's own units, rotation in radians then translation, relative to the camera's current placement. */
export type Pose = [rx: number, ry: number, rz: number, tx: number, ty: number, tz: number];

/**
 * One picture source for the world phase. The orchestrator owns exactly one at a time and swaps
 * to the next when status flips to failed. Sources are given the whole stop list at construction
 * so that advance() can find its own next seed and prompt.
 */
export interface WorldSource {
  readonly element: HTMLVideoElement;
  readonly status: WorldStatus;
  readonly name: string;
  /** Called at door entry. Connects, seeds the first stop and starts the picture with the element still hidden. */
  prepare(stop: Stop): Promise<void>;
  /** Called at each stop. Must see a frame within the first frame timeout, then plays the stop's camera rail. */
  enter(stop: Stop): Promise<void>;
  /** Moves to the next stop, seeding it from a file or from the previous frame. */
  advance(): Promise<void>;
  /** The current frame as a data URL, or null when nothing has been drawn yet. */
  captureFrame(): Promise<string | null>;
  /** Pauses and resumes the picture and its rail with the sequence. */
  pause(): void;
  resume(): void;
  /** A one shot look nudge, already clamped by the orchestrator. */
  look(dx: number, dy: number): void;
  dispose(): void;
  onStatus(cb: (status: WorldStatus, reason?: string) => void): void;
}

/** Shared helpers for the concrete sources. */
export function makeVideoElement(): HTMLVideoElement {
  const v = document.createElement('video');
  v.playsInline = true; v.autoplay = true; v.muted = false; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover'; v.style.display = 'block';
  return v;
}

/** Resolves on the next painted frame of a video element, or rejects after timeoutMs. */
export function waitForFrame(v: HTMLVideoElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const ok = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('no frame within ' + timeoutMs + ' ms')); } }, timeoutMs);
    const withCb = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    if (typeof withCb.requestVideoFrameCallback === 'function') withCb.requestVideoFrameCallback(ok);
    else { if (v.readyState >= 2 && !v.paused) ok(); v.addEventListener('timeupdate', ok, { once: true }); }
  });
}

export async function frameToDataUrl(v: HTMLVideoElement): Promise<string | null> {
  const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); if (!ctx) return null;
  try { ctx.drawImage(v, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.92); } catch { return null; }
}

export async function dataUrlToBlob(url: string): Promise<Blob> { return (await fetch(url)).blob(); }
