import * as Tone from 'tone';
import { createBuses, duck, type Buses } from './buses';
import { WorldBus } from './worldBus';

export const AUDIO_LEAD = 0.25;

export class AudioGraph {
  buses: Buses; players = new Map<string, Tone.Player>(); current: { id: string; until: number } | null = null; started = false;
  world: WorldBus | null = null;
  constructor(bedUrl: string) { this.buses = createBuses(bedUrl); }
  async start() { if (this.started) return; await Tone.start(); if (this.buses.bedPlayer.loaded) this.buses.bedPlayer.start(); this.started = true; }
  register(id: string, url: string, bus: 'voice' | 'archive' | 'foley') {
    const p = new Tone.Player({ url, fadeIn: 0.05, fadeOut: 0.4, onerror: () => undefined }).connect(this.buses[bus]); this.players.set(id, p); return p;
  }
  /** Archival clips lead the picture by AUDIO_LEAD. Callers pass the beat time and receive the transport time to fire. */
  leadTime(beatTime: number, lead = AUDIO_LEAD) { return Math.max(0, beatTime - lead); }
  play(id: string, until: number) { this.stopCurrent(); const p = this.players.get(id); if (!p || !p.loaded) return; p.start(); this.current = { id, until }; }
  stopCurrent() { if (!this.current) return; this.players.get(this.current.id)?.stop(); this.current = null; }
  tick(t: number) { if (this.current && t > this.current.until) this.stopCurrent(); duck(this.buses); }
  setBed(mult: number) { this.buses.bed.gain.rampTo(Tone.dbToGain(-30) * mult, 1); }
  /** The world bus is built on first use and torn down after its tail on return. */
  attachWorld(el: HTMLVideoElement) { (this.world ??= new WorldBus()).attach(el); }
  releaseWorld(tailMs: number) { this.world?.release(tailMs); this.world = null; }
  dispose() { this.players.forEach((p) => p.dispose()); this.world?.dispose(); }
}
