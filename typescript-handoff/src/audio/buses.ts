import * as Tone from 'tone';
import { profileSettings, type OutputProfile } from './profile';

/** The bus table. Levels are the trims each bus sits at before ducking or automation. */
export const LEVELS = { voice: 0, archive: -6, bed: -30, foley: -12, world: -12, sine: -30, master: -1.0 } as const;
export const DUCK_DB = 6;
export const DUCK_ATTACK = 0.05;
export const DUCK_RELEASE = 0.4;

export interface Buses {
  ctx: Tone.BaseContext;
  master: Tone.Limiter; masterIn: Tone.Gain; lowCut: Tone.Filter;
  voice: Tone.Gain; voiceIn: Tone.Compressor; voiceMono: Tone.Mono;
  archive: Tone.Gain; archiveIn: Tone.Filter; widener: Tone.StereoWidener;
  bed: Tone.Gain; bedIn: Tone.Filter; bedTrim: Tone.Gain;
  foley: Tone.Gain;
  world: Tone.Gain; worldIn: Tone.Convolver; sine: Tone.Oscillator; sineGain: Tone.Gain;
  droneTrim: Tone.Gain;
  meter: Tone.Meter; sense: Tone.Gain;
  setProfile(p: OutputProfile): void;
  dispose(): void;
}

/** A large room impulse. A four second exponentially decaying noise tail with a slow low pass stands in for the OpenAIR measurement until that file is placed in the library. */
export function syntheticRoomImpulse(ctx: Tone.BaseContext, seconds = 4, decay = 3.2): Tone.ToneAudioBuffer {
  const rate = ctx.sampleRate; const n = Math.floor(rate * seconds); const buf = ctx.createBuffer(2, n, rate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const env = Math.exp((-decay * i) / rate); const w = Math.random() * 2 - 1; lp += (w - lp) * 0.25; d[i] = lp * env * (i < 400 ? i / 400 : 1); } }
  return new Tone.ToneAudioBuffer(buf);
}

export function createBuses(profile: OutputProfile = 'narrow'): Buses {
  const ctx = Tone.getContext();
  const master = new Tone.Limiter(LEVELS.master).toDestination();
  const lowCut = new Tone.Filter({ frequency: 20, type: 'highpass', rolloff: -12 }).connect(master);
  const masterIn = new Tone.Gain(1).connect(lowCut);

  const voice = new Tone.Gain(Tone.dbToGain(LEVELS.voice)).connect(masterIn);
  const voiceMono = new Tone.Mono().connect(voice);
  const voiceIn = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).connect(voiceMono);

  const archive = new Tone.Gain(Tone.dbToGain(LEVELS.archive)).connect(masterIn);
  const widener = new Tone.StereoWidener(0.6).connect(archive);
  const archiveIn = new Tone.Filter({ frequency: 120, type: 'highpass' }).connect(widener);

  const bed = new Tone.Gain(Tone.dbToGain(LEVELS.bed)).connect(masterIn);
  const bedTrim = new Tone.Gain(1).connect(bed);
  const bedIn = new Tone.Filter({ frequency: 1800, type: 'lowpass' }).connect(bedTrim);

  const foley = new Tone.Gain(Tone.dbToGain(LEVELS.foley)).connect(masterIn);

  const world = new Tone.Gain(Tone.dbToGain(LEVELS.world)).connect(masterIn);
  const worldIn = new Tone.Convolver(syntheticRoomImpulse(ctx)).connect(world);
  const sineGain = new Tone.Gain(0).connect(world);
  const sine = new Tone.Oscillator({ frequency: 40, type: 'sine' }).connect(sineGain);

  const droneTrim = new Tone.Gain(1).connect(masterIn);

  const sense = new Tone.Gain(1); const meter = new Tone.Meter({ smoothing: 0.2, normalRange: true });
  sense.connect(meter); voiceIn.connect(sense); archiveIn.connect(sense);

  const setProfile = (p: OutputProfile) => { const s = profileSettings(p); widener.width.rampTo(s.widener, 0.5); droneTrim.gain.rampTo(Tone.dbToGain(s.droneTrimDb), 0.5); lowCut.frequency.rampTo(s.lowCutHz, 0.5); };
  setProfile(profile);

  const dispose = () => { [master, lowCut, masterIn, voice, voiceMono, voiceIn, archive, widener, archiveIn, bed, bedTrim, bedIn, foley, world, worldIn, sineGain, sine, droneTrim, sense, meter].forEach((n) => n.dispose()); };
  return { ctx, master, masterIn, lowCut, voice, voiceIn, voiceMono, archive, archiveIn, widener, bed, bedIn, bedTrim, foley, world, worldIn, sine, sineGain, droneTrim, meter, sense, setProfile, dispose };
}

/**
 * Ducks the bed by 6 dB under voice and archive. The envelope follower attacks in 50 ms and
 * releases over 400 ms so the bed comes back slowly after a line ends.
 */
export class Ducker {
  private env = 0;
  constructor(private buses: Buses) {}
  tick(dt: number) {
    const raw = this.buses.meter.getValue(); const level = Math.min(1, (Array.isArray(raw) ? Math.max(...raw) : raw) * 12);
    const rate = level > this.env ? DUCK_ATTACK : DUCK_RELEASE;
    this.env += (level - this.env) * (1 - Math.exp(-dt / rate));
    this.buses.bedTrim.gain.setTargetAtTime(Tone.dbToGain(-DUCK_DB * this.env), Tone.now(), 0.02);
  }
}
