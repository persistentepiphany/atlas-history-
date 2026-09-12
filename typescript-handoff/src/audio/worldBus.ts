import * as Tone from 'tone';

/**
 * The world bus. The source element's own audio is taken through a convolver for the room and
 * a sub oscillator that follows its level, so the generated picture is heard in the same space as
 * the page. On return the dry path closes at once and the reverb tail hangs over the page for the
 * configured time before the bus is torn down.
 */
export class WorldBus {
  private nodes = new Map<HTMLVideoElement, MediaElementAudioSourceNode>();
  private dry: Tone.Gain; private wet: Tone.Gain; private convolver: Tone.Convolver; private sub: Tone.Oscillator; private subGain: Tone.Gain; private follower: Tone.Meter; private input: Tone.Gain;
  private raf = 0;

  constructor() {
    this.input = new Tone.Gain(1);
    this.dry = new Tone.Gain(0.8).toDestination();
    this.wet = new Tone.Gain(0.35).toDestination();
    this.convolver = new Tone.Convolver(impulse(2.2)).connect(this.wet);
    this.input.connect(this.dry); this.input.connect(this.convolver);
    this.follower = new Tone.Meter({ smoothing: 0.85, normalRange: true }); this.input.connect(this.follower);
    this.subGain = new Tone.Gain(0).toDestination();
    this.sub = new Tone.Oscillator(42, 'sine').connect(this.subGain); this.sub.start();
    const tick = () => { const level = this.follower.getValue() as number; this.subGain.gain.rampTo(Math.min(0.18, level * 0.6), 0.1); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  attach(el: HTMLVideoElement) {
    if (this.nodes.has(el)) return;
    try {
      const raw = Tone.getContext().rawContext as AudioContext;
      const node = raw.createMediaElementSource(el);
      Tone.connect(node, this.input); this.nodes.set(el, node);
    } catch { /* an element can only be routed once, or the context is closed */ }
  }

  /** Closes the dry path now and lets the reverb hang for tailMs before the bus goes quiet. */
  release(tailMs: number) {
    this.dry.gain.rampTo(0, 0.3); this.subGain.gain.rampTo(0, 0.3);
    this.wet.gain.rampTo(0, tailMs / 1000);
    setTimeout(() => this.dispose(), tailMs + 200);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.nodes.forEach((n) => { try { n.disconnect(); } catch { /* gone */ } }); this.nodes.clear();
    [this.sub, this.subGain, this.convolver, this.wet, this.dry, this.follower, this.input].forEach((n) => n.dispose());
  }
}

/** A synthetic room, decaying noise with a soft onset. */
function impulse(seconds: number): AudioBuffer {
  const ctx = Tone.getContext(); const rate = ctx.sampleRate; const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * Math.min(1, i / (rate * 0.01)); } }
  return buf;
}
