import * as Tone from 'tone';

/** Drones never rise above this. They enter over six seconds and leave over four. */
export const DRONE_CEILING_DB = -32;
export const DRONE_IN = 6;
export const DRONE_OUT = 4;

/**
 * A slow evolving filtered oscillator. Two detuned voices through a low pass whose cutoff
 * breathes on a very slow sine, so the tone moves without ever reading as music.
 */
export class Drone {
  private a: Tone.Oscillator; private b: Tone.Oscillator; private filter: Tone.Filter; private lfo: Tone.LFO; private gain: Tone.Gain; private running = false;
  constructor(frequency: number, out: Tone.InputNode) {
    this.gain = new Tone.Gain(0).connect(out);
    this.filter = new Tone.Filter({ frequency: frequency * 3, type: 'lowpass', Q: 0.7 }).connect(this.gain);
    this.a = new Tone.Oscillator({ frequency, type: 'sine' }).connect(this.filter);
    this.b = new Tone.Oscillator({ frequency: frequency * 1.003, type: 'triangle', volume: -12 }).connect(this.filter);
    this.lfo = new Tone.LFO({ frequency: 1 / 23, min: frequency * 2, max: frequency * 5 }).connect(this.filter.frequency);
  }
  start(time = Tone.now()) {
    if (!this.running) { this.a.start(time); this.b.start(time); this.lfo.start(time); this.running = true; }
    this.gain.gain.cancelScheduledValues(time); this.gain.gain.setValueAtTime(this.gain.gain.value, time);
    this.gain.gain.linearRampToValueAtTime(Tone.dbToGain(DRONE_CEILING_DB), time + DRONE_IN);
  }
  stop(time = Tone.now(), out = DRONE_OUT) {
    this.gain.gain.cancelScheduledValues(time); this.gain.gain.setValueAtTime(this.gain.gain.value, time);
    this.gain.gain.linearRampToValueAtTime(0, time + out);
  }
  dispose() { [this.a, this.b, this.lfo, this.filter, this.gain].forEach((n) => n.dispose()); }
}

/** Band passed noise that swells over eight seconds to minus twenty and cuts at the moment the dots open. */
export const RISER_LENGTH = 8;
export const RISER_PEAK_DB = -20;
export class Riser {
  private noise: Tone.Noise; private filter: Tone.Filter; private gain: Tone.Gain;
  constructor(out: Tone.InputNode) {
    this.gain = new Tone.Gain(0).connect(out);
    this.filter = new Tone.Filter({ frequency: 240, type: 'bandpass', Q: 1.4 }).connect(this.gain);
    this.noise = new Tone.Noise('pink').connect(this.filter);
  }
  /** Schedules the swell so it peaks exactly at peakTime and cuts there. */
  fire(peakTime: number) {
    const t0 = Math.max(Tone.now(), peakTime - RISER_LENGTH);
    this.noise.start(t0); this.noise.stop(peakTime + 0.08);
    this.filter.frequency.setValueAtTime(240, t0); this.filter.frequency.exponentialRampToValueAtTime(1800, peakTime);
    const g = this.gain.gain; g.cancelScheduledValues(t0); g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Tone.dbToGain(RISER_PEAK_DB), peakTime); g.linearRampToValueAtTime(0, peakTime + 0.06);
  }
  cancel() { const t = Tone.now(); this.gain.gain.cancelScheduledValues(t); this.gain.gain.linearRampToValueAtTime(0, t + 0.3); this.noise.stop(t + 0.35); }
  dispose() { [this.noise, this.filter, this.gain].forEach((n) => n.dispose()); }
}
