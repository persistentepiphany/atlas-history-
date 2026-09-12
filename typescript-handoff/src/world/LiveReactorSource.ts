import type { Stop } from '../data/types';
import { awaitFirstFrame, makeVideo, type WorldSource } from './WorldSource';
import { FallbackSource } from './FallbackSource';

/** Opens a session on the local mock server, mounts the stream, and swaps to the fallback with no visible break if no frame arrives within 1500 ms. */
export class LiveReactorSource implements WorldSource {
  video: HTMLVideoElement | null = null; sessionId: string | null = null; fallback: FallbackSource | null = null; live = false;
  constructor(private onElement?: (v: HTMLVideoElement) => void) {}
  async open(seedUrl: string) {
    let fallbackUrl: string | null = null; let streamUrl: string | null = null;
    try {
      const res = await fetch('/reactor/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seedUrl }) });
      if (res.ok) { const body = (await res.json()) as { sessionId: string; streamUrl: string; fallbackUrl: string }; this.sessionId = body.sessionId; streamUrl = body.streamUrl; fallbackUrl = body.fallbackUrl; }
    } catch { /* no reactor, the fallback carries the world */ }
    this.fallback = new FallbackSource(fallbackUrl, this.onElement);
    if (streamUrl) {
      const v = makeVideo(streamUrl, false); this.onElement?.(v);
      try { this.video = await awaitFirstFrame(v); this.live = true; return this.video; } catch { v.pause(); }
    }
    this.video = await this.fallback.open(); return this.video;
  }
  async cut(stop: Stop) { if (this.live) return this.video; const v = await this.fallback?.cut(stop); this.video = v ?? null; return this.video; }
  async advance(prompt: string) { if (!this.sessionId) return; await fetch('/reactor/session/' + this.sessionId + '/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) }).catch(() => undefined); }
  close() { this.video?.pause(); this.fallback?.close(); if (this.sessionId) void fetch('/reactor/session/' + this.sessionId, { method: 'DELETE' }).catch(() => undefined); this.sessionId = null; this.live = false; }
}
