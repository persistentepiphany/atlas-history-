import type { Stop, WorldConfig } from '../data/types';
import { type WorldSource, type WorldStatus, type Pose, makeVideoElement, waitForFrame, frameToDataUrl } from './WorldSource';
import { CameraRail } from './CameraRail';
import { reactorConfig, worldAsset } from './config';

/**
 * The still picture source of last resort. It draws each stop's seed onto a canvas, integrates
 * the same camera rail as the live source into a two dimensional move, and streams the canvas
 * into the video element. It is what plays when no live model and no fallback film are
 * reachable, and it is what the pre-render records when the live path is unavailable, so that
 * every stop still lands on the right picture at the right time.
 */
export class SeedSource implements WorldSource {
  readonly name = 'seed';
  readonly element = makeVideoElement();
  status: WorldStatus = 'idle';
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private previous: HTMLImageElement | null = null;
  private fade = 1;
  private cam = { zoom: 1, x: 0, y: 0 };
  private rail: CameraRail;
  private index = 0; private raf = 0; private paused = false;
  private listeners: ((s: WorldStatus, reason?: string) => void)[] = [];

  constructor(private world: WorldConfig, private eventId: string, width = 1280, height = 720) {
    this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.rail = new CameraRail({ applyPose: (p) => this.applyPose(p) });
    const stream = (this.canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    this.element.srcObject = stream; this.element.muted = true;
  }
  onStatus(cb: (s: WorldStatus, reason?: string) => void) { this.listeners.push(cb); }
  private set(s: WorldStatus, reason?: string) { if (this.status === 'failed') return; this.status = s; this.listeners.forEach((l) => l(s, reason)); }
  private fail(reason: string) { this.set('failed', reason); this.status = 'failed'; }

  /** A dolly zooms in, yaw and pitch slide the crop, so the same rail reads as the same intent. */
  private applyPose(p: Pose) { this.cam.zoom = Math.max(1, this.cam.zoom * (1 + p[5] * 0.9)); this.cam.x += p[1] * 0.9; this.cam.y += p[0] * 0.9; }

  private cache = new Map<string, HTMLImageElement>();

  private async load(stop: Stop): Promise<HTMLImageElement> {
    if (typeof stop.seed !== 'string') { const url = await this.captureFrame(); if (!url) throw new Error('no previous frame'); return loadImage(url); }
    const url = worldAsset(this.eventId, stop.seed);
    const held = this.cache.get(url); if (held) return held;
    const img = await loadImage(url); this.cache.set(url, img); return img;
  }

  /** Every seed of the visit is fetched at door entry, so a stop still lands on its own picture when
   *  the network goes away in the middle of the world. */
  private async warm() {
    await Promise.all(this.world.stops.map(async (s) => { if (typeof s.seed === 'string') await this.load(s).catch(() => undefined); }));
  }

  private draw = () => {
    const { width: W, height: H } = this.canvas; const ctx = this.ctx;
    ctx.fillStyle = '#060504'; ctx.fillRect(0, 0, W, H);
    const drawImg = (img: HTMLImageElement, alpha: number) => {
      const s = Math.max(W / img.width, H / img.height) * this.cam.zoom;
      const w = img.width * s, h = img.height * s;
      const cx = W / 2 - w / 2 - this.cam.x * W, cy = H / 2 - h / 2 - this.cam.y * H;
      ctx.globalAlpha = alpha; ctx.drawImage(img, Math.min(0, Math.max(W - w, cx)), Math.min(0, Math.max(H - h, cy)), w, h); ctx.globalAlpha = 1;
    };
    if (this.previous && this.fade < 1) drawImg(this.previous, 1);
    if (this.image) drawImg(this.image, this.fade);
    if (this.fade < 1) this.fade = Math.min(1, this.fade + 16 / reactorConfig.stopCrossfadeMs);
    this.raf = requestAnimationFrame(this.draw);
  };

  async prepare(stop: Stop) {
    try {
      this.set('connecting');
      this.index = Math.max(0, this.world.stops.indexOf(stop));
      this.image = await this.load(stop); this.cam = { zoom: 1, x: 0, y: 0 };
      if (!this.raf) this.draw();
      await this.element.play();
      void this.warm();
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }
  async enter(stop: Stop) {
    if (this.status === 'failed') throw new Error('source failed');
    try {
      const i = this.world.stops.indexOf(stop);
      if (i >= 0 && i !== this.index) { this.index = i; const img = await this.load(stop).catch(() => null); if (img) { this.previous = this.image; this.image = img; this.fade = 0; this.cam = { zoom: 1, x: 0, y: 0 }; } }
      await waitForFrame(this.element, reactorConfig.firstFrameTimeoutMs);
      this.set('streaming'); this.rail.play(stop.camera);
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }
  async advance() {
    if (this.status === 'failed') throw new Error('source failed');
    const next = this.world.stops[this.index + 1]; if (!next) return;
    this.rail.stop();
    /** A seed that cannot be fetched holds the picture it already has rather than emptying the world. */
    const img = await this.load(next).catch(() => null);
    this.index += 1;
    if (!img) return;
    this.previous = this.image; this.image = img; this.fade = 0; this.cam = { zoom: 1, x: 0, y: 0 };
  }
  captureFrame() { return frameToDataUrl(this.element).then((u) => u ?? this.canvas.toDataURL('image/jpeg', 0.92)); }
  pause() { this.paused = true; this.rail.pause(); }
  resume() { if (this.paused) { this.paused = false; this.rail.resume(); } }
  look(dx: number, dy: number) { this.rail.look(dx, dy); }
  dispose() { this.rail.stop(); cancelAnimationFrame(this.raf); this.raf = 0; this.element.srcObject = null; this.element.remove(); }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('seed missing ' + src)); img.src = src; });
}
