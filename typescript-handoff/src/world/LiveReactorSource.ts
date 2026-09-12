import type { Stop, WorldConfig } from '../data/types';
import { type WorldSource, type WorldStatus, type Pose, makeVideoElement, waitForFrame, frameToDataUrl, dataUrlToBlob } from './WorldSource';
import { ReactorClient } from './reactor/client';
import { CameraRail } from './CameraRail';
import { reactorConfig, worldAsset } from './config';

export interface SessionGrant { token: string; model: string; expiresAt: string; mock?: boolean }

/**
 * The generated world, streamed live from a Reactor session. prepare mints the session, uploads
 * the first seed, sets the shot card and starts the stream with the element still hidden. enter
 * demands a frame within firstFrameTimeoutMs and then plays the stop's rail. advance re-seeds
 * the model from the next file or from the previous frame. Any failure flips status to failed
 * and the orchestrator swaps sources.
 */
export class LiveReactorSource implements WorldSource {
  readonly name = 'live';
  readonly element = makeVideoElement();
  status: WorldStatus = 'idle';
  private client: ReactorClient | null = null;
  private rail: CameraRail;
  private index = 0;
  private listeners: ((s: WorldStatus, reason?: string) => void)[] = [];
  private lastFrame: string | null = null;
  private disposed = false;

  constructor(private world: WorldConfig, private eventId: string, private mintSession: (model?: string) => Promise<SessionGrant> = defaultMint) {
    this.rail = new CameraRail({
      applyPose: (pose: Pose) => { void this.client?.setCameraPose([pose]); },
      release: () => { void this.client?.setCameraPose([]); },
    });
  }

  onStatus(cb: (s: WorldStatus, reason?: string) => void) { this.listeners.push(cb); }
  private set(s: WorldStatus, reason?: string) { if (this.status === 'failed' || this.disposed) return; this.status = s; this.listeners.forEach((l) => l(s, reason)); }
  private fail(reason: string) { if (this.status === 'failed') return; this.rail.stop(); this.set('failed', reason); this.status = 'failed'; }

  private stopAt(i: number): Stop { const s = this.world.stops[i]; if (!s) throw new Error('no stop ' + i); return s; }

  private async seedBlob(stop: Stop): Promise<{ blob: Blob; name: string }> {
    if (typeof stop.seed === 'string') {
      const url = worldAsset(this.eventId, stop.seed);
      const res = await fetch(url); if (!res.ok) throw new Error('seed missing ' + url);
      return { blob: await res.blob(), name: stop.seed.split('/').pop() ?? 'seed' };
    }
    const frame = this.lastFrame ?? (await this.captureFrame());
    if (!frame) throw new Error('no previous frame to seed from');
    return { blob: await dataUrlToBlob(frame), name: 'previous-frame.jpg' };
  }

  private shotCard(stop: Stop) { return stop.negative ? stop.prompt + ' Avoid ' + stop.negative + '.' : stop.prompt; }

  private async seed(stop: Stop) {
    const c = this.client; if (!c) throw new Error('no client');
    const { blob, name } = await this.seedBlob(stop);
    const ref = await c.uploadImage(blob, name);
    await c.setImage(ref);
    await c.setPrompt(this.shotCard(stop));
  }

  async prepare(stop: Stop) {
    try {
      this.set('connecting');
      this.index = this.world.stops.indexOf(stop); if (this.index < 0) this.index = 0;
      const grant = await this.mintSession(this.world.model ?? reactorConfig.defaultModel);
      if (grant.mock) throw new Error('mock session, no live model');
      this.client = new ReactorClient({
        model: grant.model, token: grant.token,
        onTrack: (stream) => { this.element.srcObject = stream; void this.element.play().catch(() => undefined); },
        onFailure: (reason) => this.fail(reason),
      });
      await this.client.connect();
      await this.seed(stop);
      await this.client.start();
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }

  async enter(stop: Stop) {
    if (this.status === 'failed') throw new Error('source failed');
    try {
      await waitForFrame(this.element, reactorConfig.firstFrameTimeoutMs);
      this.set('streaming');
      this.rail.play(stop.camera);
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }

  async advance() {
    if (this.status === 'failed') throw new Error('source failed');
    const c = this.client; if (!c) throw new Error('no client');
    try {
      const current = this.stopAt(this.index);
      if (current.captureFrame || typeof this.stopAt(this.index + 1).seed !== 'string') this.lastFrame = await this.captureFrame();
      this.rail.stop();
      this.index += 1;
      const next = this.stopAt(this.index);
      await c.reset();
      await this.seed(next);
      await c.clearContext().catch(() => undefined);
      await c.start();
    } catch (e) { this.fail(e instanceof Error ? e.message : String(e)); throw e; }
  }

  captureFrame() { return frameToDataUrl(this.element); }
  pause() { this.rail.pause(); void this.client?.pause(); }
  resume() { this.rail.resume(); void this.client?.resume(); }
  look(dx: number, dy: number) { this.rail.look(dx, dy); }
  dispose() { this.disposed = true; this.rail.stop(); const c = this.client; this.client = null; void c?.dispose(); this.element.srcObject = null; this.element.remove(); }
}

async function defaultMint(model?: string): Promise<SessionGrant> {
  const res = await fetch('/reactor/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) });
  if (!res.ok) throw new Error('session endpoint answered ' + res.status);
  return (await res.json()) as SessionGrant;
}
