import type { AlignedWord } from '../data/types';

/** Two lines of forty two characters. A cue stays between one and six seconds. */
export const LINE_CHARS = 42;
export const LINES = 2;
export const CUE_MIN = 1.0;
export const CUE_MAX = 6.0;
export const GAP_BREAK = 0.35;

export interface Cue { text: string; start: number; end: number; speaker?: string }

const CAP = LINE_CHARS * LINES;

/** Breaks a line into cue texts of at most two lines, preferring a break on punctuation. */
export function splitText(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean); const out: string[] = []; let cur: string[] = [];
  const flush = () => { if (cur.length) { out.push(cur.join(' ')); cur = []; } };
  for (const w of words) {
    const next = [...cur, w].join(' ');
    if (next.length > CAP) { flush(); cur = [w]; continue; }
    cur.push(w);
    if (/[.!?;:]["”»]?$/.test(w) && next.length > CAP * 0.55) flush();
  }
  flush();
  return out;
}

/** Wraps a cue text into at most two display lines at LINE_CHARS. */
export function wrapLines(text: string): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { const next = cur ? cur + ' ' + w : w; if (next.length > LINE_CHARS && cur) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  return lines.slice(0, LINES);
}

/** Cues from a plain text and a window. Each cue takes a share of the window by character count, clamped to the cue range. */
export function cuesFromText(text: string, start: number, end: number, speaker?: string): Cue[] {
  const parts = splitText(text); if (!parts.length) return [];
  const total = parts.reduce((n, p) => n + p.length, 0); const span = Math.max(CUE_MIN, end - start); let t = start; const out: Cue[] = [];
  for (const p of parts) { const d = Math.min(CUE_MAX, Math.max(CUE_MIN, (span * p.length) / total)); out.push({ text: p, start: t, end: t + d, speaker }); t += d; }
  return out;
}

/** Cues from measured word times. Breaks on punctuation, on gaps over 350 ms, or when the two lines are full. Speaker labels come from diarisation. */
export function cuesFromAlignment(words: AlignedWord[], offset = 0): Cue[] {
  const out: Cue[] = []; let cur: AlignedWord[] = [];
  const flush = () => { if (!cur.length) return; const first = cur[0]!, last = cur[cur.length - 1]!; const start = offset + first.start; const end = Math.min(start + CUE_MAX, Math.max(start + CUE_MIN, offset + last.end)); out.push({ text: cur.map((w) => w.w).join(' '), start, end, speaker: first.speaker }); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!; const prev = cur[cur.length - 1];
    if (prev && (w.start - prev.end > GAP_BREAK || (w.speaker && w.speaker !== prev.speaker) || [...cur, w].map((x) => x.w).join(' ').length > CAP)) flush();
    cur.push(w);
    if (/[.!?]["”»]?$/.test(w.w)) flush();
  }
  flush();
  for (let i = 0; i + 1 < out.length; i++) out[i]!.end = Math.min(out[i]!.end, out[i + 1]!.start);
  return out;
}

export function cueAt(cues: Cue[], t: number): Cue | undefined { return cues.find((c) => t >= c.start && t < c.end); }
