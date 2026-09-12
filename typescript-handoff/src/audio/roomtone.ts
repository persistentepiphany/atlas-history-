import * as Tone from 'tone';

/**
 * Room tone rendered offline. Brown noise through a low pass, looped, which stands in for
 * a recorded bed until a file is placed under library/beds. It never falls silent.
 */
export function renderRoomTone(seconds = 8, sampleRate = 48000): AudioBuffer {
  const n = Math.floor(seconds * sampleRate); const buf = Tone.getContext().createBuffer(2, n, sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let b0 = 0; let lp = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.985 * b0 + 0.015 * w; lp += (b0 - lp) * 0.12; d[i] = lp * 2.4; }
    const fade = Math.floor(sampleRate * 0.5);
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = (d[i] ?? 0) * k; d[n - 1 - i] = (d[n - 1 - i] ?? 0) * k; }
  }
  return buf;
}
