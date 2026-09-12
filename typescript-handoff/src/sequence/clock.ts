/**
 * The master clock. While a voice element plays, its currentTime is the clock and every
 * other layer follows it. Otherwise the clock accumulates frame time. Each voice start
 * resyncs the accumulated time so the two never diverge across a sequence.
 */
export class MasterClock {
  private accumulated = 0;
  private voice: { el: HTMLMediaElement; offset: number } | null = null;
  paused = false;

  get time() { return this.voice ? this.voice.offset + this.voice.el.currentTime : this.accumulated; }

  /** Advances the accumulated time by dt while no voice drives the clock. */
  tick(dt: number) {
    if (this.paused) return;
    if (this.voice) { const el = this.voice.el; if (el.ended || el.paused || el.error) { this.accumulated = this.voice.offset + el.currentTime; this.voice = null; } }
    if (!this.voice) this.accumulated += dt;
  }

  /** Hands the clock to a playing voice element. The element starts at zero and the timeline position is its offset. */
  attachVoice(el: HTMLMediaElement, offset: number) { this.accumulated = offset + el.currentTime; this.voice = { el, offset }; }
  detachVoice(el?: HTMLMediaElement) { if (this.voice && (!el || this.voice.el === el)) { this.accumulated = this.time; this.voice = null; } }
  get voiceElement() { return this.voice?.el ?? null; }

  seek(t: number) {
    if (this.voice) { const local = t - this.voice.offset; if (local >= 0 && local < (this.voice.el.duration || Infinity)) { this.voice.el.currentTime = local; return; } this.voice = null; }
    this.accumulated = t;
  }
  reset(t = 0) { this.voice = null; this.accumulated = t; this.paused = false; }
}
