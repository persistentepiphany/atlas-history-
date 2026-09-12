import { describe, expect, it } from 'vitest';
import { CUE_MAX, CUE_MIN, cuesFromAlignment, cuesFromText, LINE_CHARS, LINES, splitText, wrapLines } from './chunk';

describe('cues', () => {
  it('keeps every cue within two lines of forty two characters', () => {
    const text = 'Houston, Tranquility Base here. The Eagle has landed. It is a frame from a television signal, and the film in the cameras is still in orbit above the surface of the Moon tonight.';
    for (const part of splitText(text)) { const lines = wrapLines(part); expect(lines.length).toBeLessThanOrEqual(LINES); for (const l of lines) expect(l.length).toBeLessThanOrEqual(LINE_CHARS); }
  });
  it('holds each cue between one and six seconds', () => {
    const cues = cuesFromText('One. Two words here. Three more words follow this one and go on for a while, so the line is long.', 10, 40);
    for (const c of cues) { expect(c.end - c.start).toBeGreaterThanOrEqual(CUE_MIN); expect(c.end - c.start).toBeLessThanOrEqual(CUE_MAX); }
    expect(cues[0]!.start).toBe(10);
  });
  it('breaks measured words on punctuation, on gaps over 350 ms, and on speaker change', () => {
    const cues = cuesFromAlignment([
      { w: 'Houston,', start: 0, end: 0.4, speaker: 'Armstrong' }, { w: 'Tranquility', start: 0.45, end: 0.9, speaker: 'Armstrong' }, { w: 'Base', start: 0.95, end: 1.2, speaker: 'Armstrong' }, { w: 'here.', start: 1.25, end: 1.6, speaker: 'Armstrong' },
      { w: 'Roger,', start: 2.4, end: 2.7, speaker: 'Duke' }, { w: 'Tranquility.', start: 2.75, end: 3.4, speaker: 'Duke' },
    ], 50);
    expect(cues.map((c) => c.text)).toEqual(['Houston, Tranquility Base here.', 'Roger, Tranquility.']);
    expect(cues[0]!.speaker).toBe('Armstrong'); expect(cues[0]!.start).toBe(50); expect(cues[1]!.start).toBe(52.4);
  });
});
