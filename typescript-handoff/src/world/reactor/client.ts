import { Reactor, type FileRef, type ReactorMessage, type ReactorStatus } from '@reactor-team/js-sdk';
import type { Pose } from '../WorldSource';

/**
 * The only module that imports the Reactor SDK. It wraps the handful of calls the world needs,
 * connect, upload, set_image, set_prompt, start, pause, resume, reset, the pose commands and
 * disposal, so that the rest of the world layer speaks only in terms of stops and poses.
 *
 * Command names and payloads follow the LingBot model schemas shipped in the typed model packages,
 * which are recorded in REACTOR_NOTES.md. sendCommand never rejects, so every call reads the
 * reply and the last error to turn a rejected command into a thrown error.
 */
export interface ReactorClientOptions { model: string; token: string; apiUrl?: string; onTrack: (stream: MediaStream) => void; onFailure: (reason: string) => void; onMessage?: (m: ReactorMessage) => void }

const VIDEO_TRACK = 'main_video';

export class ReactorClient {
  private reactor: Reactor;
  private failed = false;
  constructor(private opts: ReactorClientOptions) {
    this.reactor = new Reactor({
      modelName: opts.model, jwt: opts.token, apiUrl: opts.apiUrl,
      modelTracks: [{ name: VIDEO_TRACK, kind: 'video', direction: 'recvonly' }],
      readyTimeoutMs: 20_000, logLevel: 'warn',
    });
    this.reactor.on('trackReceived', (_name, track, stream) => { if (track.kind === 'video') opts.onTrack(stream); });
    this.reactor.on('error', (e) => { if (!e.recoverable) this.fail(e.code + ' ' + e.message); });
    this.reactor.on('statusChanged', (s: ReactorStatus) => { if (s === 'disconnected' && this.wasReady) this.fail('disconnected'); if (s === 'ready') this.wasReady = true; });
    this.reactor.on('message', (m) => { opts.onMessage?.(m); if (m.type === 'command_error') this.fail('command_error ' + JSON.stringify(m.data)); });
  }
  private wasReady = false;
  private fail(reason: string) { if (this.failed) return; this.failed = true; this.opts.onFailure(reason); }

  get status() { return this.reactor.getStatus(); }

  async connect() { await this.reactor.connect(); }

  async uploadImage(blob: Blob, name: string): Promise<FileRef> { return this.reactor.uploadFile(blob, { name }); }

  private async command(name: string, data?: Record<string, unknown>) {
    const reply = await this.reactor.sendCommand(name, data);
    const err = this.reactor.getLastError();
    if (reply === undefined && err && err.operation === 'sendCommand') throw new Error(name + ' failed, ' + err.code + ' ' + err.message);
    return reply;
  }

  setImage(image: FileRef) { return this.command('set_image', { image }); }
  setPrompt(prompt: string) { return this.command('set_prompt', { prompt }); }
  start() { return this.command('start'); }
  pause() { return this.command('pause'); }
  resume() { return this.command('resume'); }
  reset() { return this.command('reset'); }
  /** A flat list of one or more six value steps, or an empty list to release the rail. LingBot World 2 only, other models ignore the command. */
  setCameraPose(steps: Pose[]) { return this.command('set_camera_pose', { camera_pose: steps.flat() }); }
  /** Discrete look controls for models without a pose channel. */
  setLook(horizontal: 'idle' | 'left' | 'right', vertical: 'idle' | 'up' | 'down') {
    return Promise.all([this.command('set_look_horizontal', { look_horizontal: horizontal }), this.command('set_look_vertical', { look_vertical: vertical })]);
  }
  setMove(longitudinal: 'idle' | 'forward' | 'back') { return this.command('set_move_longitudinal', { move_longitudinal: longitudinal }); }
  /** Clears the model's accumulated context at a hard cut, so the new seed is not haunted by the previous stop. */
  clearContext() { return this.command('trigger_kv_cache_reset'); }

  async dispose() { try { await this.reactor.disconnect(); } catch { /* already gone */ } this.reactor[Symbol.dispose](); }
}
