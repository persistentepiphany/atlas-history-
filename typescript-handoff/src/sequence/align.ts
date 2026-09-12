import type { AlignedWord, LineBox, Scenario, WordBox } from '../data/types';

export interface Aligned { page: string; w: WordBox; start: number; end: number; driftLine?: number; text?: string }

interface AlignSpec { start: number; end?: number; rate?: number; words?: [number, number]; page?: string; match?: string }

/** Synthetic timing at a fixed rate. The fallback while no alignment file exists for a read. */
export function buildAlign(sc: Scenario, words: Record<string, WordBox[]>, lines: Record<string, LineBox[]>): Aligned[] {
  const al: Aligned[] = []; const a = sc.align as Record<string, AlignSpec | undefined>;
  const rw = words[sc.readPage] ?? [];
  if (a.headline?.words) { const [s, e] = a.headline.words; const n = e - s; const end = a.headline.end ?? a.headline.start; for (let i = s; i < e; i++) { const w = rw[i]; if (w) al.push({ page: sc.readPage, w, start: a.headline.start + (end - a.headline.start) * (i - s) / n, end: a.headline.start + (end - a.headline.start) * (i - s + 0.9) / n }); } }
  if (a.lead?.words) { const [s, e] = a.lead.words; let t = a.lead.start; for (let i = s; i < e; i++) { const w = rw[i]; if (!w) break; const d = (0.6 + 0.08 * w.w.length) / (a.lead.rate ?? 2.6); al.push({ page: sc.readPage, w, start: t, end: t + d * 0.92 }); t += d; } }
  if (a.memo?.page && a.memo.match) { const memo = a.memo; const ws = words[memo.page!] ?? []; const target = memo.match!.split(' '); const idx = ws.findIndex((_, i) => target.every((tw, j) => ws[i + j]?.w === tw)); const end = memo.end ?? memo.start; if (idx >= 0) target.forEach((_, j) => al.push({ page: memo.page!, w: ws[idx + j]!, start: memo.start + (end - memo.start) * j / target.length, end: memo.start + (end - memo.start) * (j + 0.9) / target.length })); }
  if (a.drift) { const d = a.drift; const ls = lines[sc.readPage] ?? []; const end = d.end ?? d.start; ls.forEach((l, i) => al.push({ page: sc.readPage, w: { w: '', x: l.x ?? 0, y: l.y, width: l.w ?? 0, height: l.h, conf: 1, line: i }, start: d.start + (end - d.start) * i / ls.length, end: d.start + (end - d.start) * (i + 1) / ls.length, driftLine: i })); }
  return al.sort((x, y) => x.start - y.start);
}

/**
 * Replaces the synthetic timing of one read with measured word times from an alignment file.
 * Words are matched in order against the page word boxes of the read span, so the wash lands
 * on the spoken word. Unmatched words keep their synthetic timing.
 */
export function applyAlignment(al: Aligned[], measured: AlignedWord[], offset: number, span: { page: string; words: [number, number] }, boxes: WordBox[]): Aligned[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out = al.filter((x) => !(x.page === span.page && boxes.indexOf(x.w) >= span.words[0] && boxes.indexOf(x.w) < span.words[1]));
  let cursor = 0;
  for (let i = span.words[0]; i < span.words[1]; i++) {
    const box = boxes[i]; if (!box) break; const key = norm(box.w);
    let hit = -1; for (let j = cursor; j < Math.min(measured.length, cursor + 6); j++) { if (norm(measured[j]!.w) === key) { hit = j; break; } }
    if (hit >= 0) { const m = measured[hit]!; out.push({ page: span.page, w: box, start: offset + m.start, end: offset + m.end }); cursor = hit + 1; }
    else { const prev = al.find((x) => x.w === box); if (prev) out.push(prev); }
  }
  return out.sort((x, y) => x.start - y.start);
}
