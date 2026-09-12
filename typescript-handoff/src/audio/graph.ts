import * as Tone from 'tone';
import { createBuses, Ducker, LEVELS, type Buses } from './buses';
import { Drone, Riser } from './drones';
import { renderRoomTone } from './roomtone';
import { detectOutputProfile, type OutputProfile } from './profile';
import type { MasterClock } from '../sequence/clock';

/** Every transition is a J cut. Audio leads picture by this much. */
export const AUDIO_LEAD = 0.25;
/** The return from the world is the one L cut. The room tail hangs this long over the page. */
export const RETURN_TAIL = 1.5;

export type BusName = 'voice' | 'archive' | 'world';
export interface ClipSpec { src: string; bus: BusName; start?: number }

interface Player { id: string; el: HTMLMediaElement; gain: Tone.Gain; bus: BusName; start: number; ready: boolean }

/**
 * The audio graph. Every media element enters the graph through a MediaElementSource so the
 * bus treatment, ducking and limiter apply to all of it. There is no plain Audio branch.
 */
export class AudioGraph {
  buses: Buses; players = new Map<string, Player>(); current: { p: Player; until: number } | null = null; started = false;
  private ducker: Ducker; private bed: Tone.Player | null = null; private bedTarget = 0;
  private readDrone: Drone; private worldDrone: Drone; private riser: Riser;
  private foleyNoise: Tone.Noise | null = null; private bedHold = 0;
  profile: OutputProfile = 'narrow';

  constructor() {
    this.buses = createBuses(this.profile); this.ducker = new Ducker(this.buses);
    this.readDrone = new Drone(55, this.buses.droneTrim); this.worldDrone = new Drone(40, this.buses.droneTrim); this.riser = new Riser(this.buses.masterIn);
  }

  async start() {
    if (this.started) return; await Tone.start(); this.started = true;
    this.profile = await detectOutputProfile(); this.buses.setProfile(this.profile);
    this.bed = new Tone.Player({ url: new Tone.ToneAudioBuffer(renderRoomTone()), loop: true }).connect(this.buses.bedIn); this.bed.start();
    this.buses.sine.start(); this.foleyNoise = new Tone.Noise('pink');
  }

  /** Registers a clip. Elements are created lazily and are shared across plays. Remote files need CORS or they stay silent. */
  register(id: string, spec: ClipSpec) {
    if (this.players.has(id)) return;
    const el = document.createElement('audio'); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.src = spec.src;
    const gain = new Tone.Gain(0); const bus = spec.bus === 'voice' ? this.buses.voiceIn : spec.bus === 'world' ? this.buses.worldIn : this.buses.archiveIn;
    gain.connect(bus);
    const source = this.buses.ctx.createMediaElementSource(el as HTMLAudioElement); Tone.connect(source, gain);
    const p: Player = { id, el, gain, bus: spec.bus, start: spec.start ?? 0, ready: false };
    el.addEventListener('loadedmetadata', () => { p.ready = true; }, { once: true });
    el.addEventListener('error', () => { console.warn('audio unavailable', id, spec.src); }, { once: true });
    this.players.set(id, p);
  }

  /** Routes a video element's sound through the world bus. Called once per element. */
  attachWorldVideo(el: HTMLVideoElement) {
    try { const src = this.buses.ctx.createMediaElementSource(el); const g = new Tone.Gain(1).connect(this.buses.worldIn); Tone.connect(src, g); } catch { /* an element can be attached once and later calls are ignored */ }
  }

  private begin(p: Player, offset = 0) {
    const go = () => { try { p.el.currentTime = p.start + offset; } catch { /* metadata pending */ } void p.el.play().catch(() => undefined); };
    if (p.el.readyState >= 1) go(); else p.el.addEventListener('loadedmetadata', go, { once: true });
  }

  /** Plays an archive clip on the archive bus with a 300 ms rise. The previous clip fades under it. */
  play(id: string, until: number) {
    const p = this.players.get(id); if (!p) return; this.stopCurrent();
    const t = Tone.now(); p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(0, t); p.gain.gain.linearRampToValueAtTime(1, t + 0.3);
    this.begin(p); this.current = { p, until };
  }
  stopCurrent(fade = 0.4) {
    if (!this.current) return; const { p } = this.current; this.current = null; const t = Tone.now();
    p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { if (!this.current || this.current.p !== p) p.el.pause(); }, fade * 1000 + 50);
  }

  /** Plays a narrator line on the voice bus and hands the master clock to it. Resolves false when no file exists for the line. */
  playVoice(id: string, clock: MasterClock, timelineAt: number): boolean {
    const p = this.players.get(id); if (!p || p.bus !== 'voice') return false;
    const t = Tone.now(); p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(1, t);
    const prev = clock.voiceElement; if (prev && prev !== p.el) { prev.pause(); clock.detachVoice(prev); }
    this.begin(p, Math.max(0, clock.time - timelineAt)); clock.attachVoice(p.el, timelineAt);
    p.el.addEventListener('ended', () => clock.detachVoice(p.el), { once: true });
    return true;
  }

  /** Foley. Sample players are not in the library yet, so short filtered noise bursts stand in at the foley trim, panned toward the object. */
  foley(id: string, pan = 0, until?: number, now = 0) {
    if (!this.started || !this.foleyNoise) return; const t = Tone.now(); const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan))).connect(this.buses.foley);
    const burst = (dur: number, freq: number, q: number, level: number, sweepTo?: number) => {
      const f = new Tone.Filter({ frequency: freq, type: 'bandpass', Q: q }).connect(panner); const g = new Tone.Gain(0).connect(f); const n = new Tone.Noise('pink').connect(g);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.start(t); n.stop(t + dur + 0.05); setTimeout(() => { n.dispose(); g.dispose(); f.dispose(); }, (dur + 0.5) * 1000);
    };
    const len = Math.max(0.5, (until ?? now + 2) - now);
    if (id === 'F01') burst(0.35, 900, 1.2, 0.5);
    if (id === 'F02') burst(0.6, 400, 0.8, 0.6, 2600);
    if (id === 'F03') { const ticks = Math.round(len * 14); for (let i = 0; i < ticks; i++) setTimeout(() => burst(0.03, 2400, 3, 0.35), (i / 14) * 1000); }
    if (id === 'F04') { const o = new Tone.Oscillator({ frequency: 1180, type: 'sine' }).connect(panner); o.volume.value = -60; o.start(t); o.volume.linearRampToValueAtTime(-22, t + 2); o.volume.linearRampToValueAtTime(-12, t + len - 0.5); o.volume.linearRampToValueAtTime(-60, t + len + 0.05); o.stop(t + len + 0.1); setTimeout(() => o.dispose(), (len + 0.5) * 1000); }
    setTimeout(() => panner.dispose(), (len + 1) * 1000);
  }

  /** The read drone enters with the read and leaves before the door. */
  readDroneOn() { this.readDrone.start(); }
  readDroneOff() { this.readDrone.stop(); }
  /** The world drone and the 40 Hz sine rise over the dissolve and hold. */
  worldOn(dissolve = 2) { this.worldDrone.start(); const t = Tone.now(); this.buses.sineGain.gain.cancelScheduledValues(t); this.buses.sineGain.gain.linearRampToValueAtTime(Tone.dbToGain(LEVELS.sine), t + dissolve); }
  /** The L cut. The reverb tail and the sine hang RETURN_TAIL over the page before the room tone takes over. */
  worldOff() {
    const t = Tone.now(); this.worldDrone.stop(t + RETURN_TAIL, 2);
    this.buses.sineGain.gain.cancelScheduledValues(t); this.buses.sineGain.gain.setValueAtTime(this.buses.sineGain.gain.value, t); this.buses.sineGain.gain.linearRampToValueAtTime(0, t + RETURN_TAIL + 1);
    this.bedHold = RETURN_TAIL;
  }
  /** Schedules the door riser to peak when the dots open. */
  riserFor(secondsUntilOpen: number) { this.riser.fire(Tone.now() + Math.max(0, secondsUntilOpen)); }
  cancelRiser() { this.riser.cancel(); }

  setBed(mult: number) { this.bedTarget = mult; }
  pause() { for (const p of this.players.values()) if (!p.el.paused) p.el.pause(); }
  resume(clockVoice: HTMLMediaElement | null) { if (this.current) void this.current.p.el.play().catch(() => undefined); if (clockVoice) void clockVoice.play().catch(() => undefined); }

  tick(dt: number, t: number) {
    if (!this.started) return;
    if (this.current && t > this.current.until) this.stopCurrent();
    this.ducker.tick(dt);
    if (this.bedHold > 0) this.bedHold -= dt; else this.buses.bed.gain.setTargetAtTime(Tone.dbToGain(LEVELS.bed) * this.bedTarget, Tone.now(), 0.6);
  }
  dispose() { this.stopCurrent(0.05); this.players.forEach((p) => { p.el.pause(); p.gain.dispose(); }); this.bed?.dispose(); this.readDrone.dispose(); this.worldDrone.dispose(); this.riser.dispose(); this.foleyNoise?.dispose(); this.buses.dispose(); }
}
