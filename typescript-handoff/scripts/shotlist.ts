import { readFile, writeFile } from 'node:fs/promises';
const fmt = (t: number) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const { events } = JSON.parse(await readFile('scenarios/index.json', 'utf8')) as { events: string[] };
let out = '# Shot list\n\nPrinted from the scenario files by npm run shotlist.\n';
interface Stop { t: number; label: string; seed: string | { fromPreviousFrame: true }; prompt: string; camera: Record<string, number>[]; hold?: number; archive?: string; voice?: string }
for (const id of events) {
  const sc = JSON.parse(await readFile('scenarios/' + id + '.json', 'utf8')) as { title: string; beats: { t: number; phase: string; voice?: { id: string; text: string }; caption?: { text: string } | null; camera?: { z?: number } }[]; world: { treatment: string; objective: string; fallback: string; fallbackOffsets?: number[]; stops: Stop[] } };
  out += '\n## ' + sc.title + '\n\n| T | Phase | Camera z | Spoken |\n|---|---|---|---|\n';
  for (const b of sc.beats) out += '| ' + fmt(b.t) + ' | ' + b.phase + ' | ' + (b.camera?.z ?? '') + ' | ' + (b.voice ? b.voice.id + ', ' + b.voice.text : b.caption?.text ?? '') + ' |\n';
  out += '\nWorld, treatment ' + sc.world.treatment + ', objective ' + sc.world.objective + ', fallback ' + sc.world.fallback + '\n\n';
  out += '| T | Offset | Stop | Seed | Rail | Hold | Archive | Narrator |\n|---|---|---|---|---|---|---|---|\n';
  sc.world.stops.forEach((s, i) => {
    const seed = typeof s.seed === 'string' ? s.seed : 'previous frame';
    const rail = s.camera.map((m) => Object.entries(m).map(([k, v]) => k + ' ' + v).join(' over ')).join(', ');
    out += '| ' + fmt(s.t) + ' | ' + (sc.world.fallbackOffsets?.[i]?.toFixed(2) ?? '') + ' | ' + s.label + ' | ' + seed + ' | ' + rail + ' | ' + (s.hold ?? '') + ' | ' + (s.archive ?? '') + ' | ' + (s.voice ?? '') + ' |\n';
  });
  out += '\nShot cards\n\n';
  for (const s of sc.world.stops) out += '- ' + s.label + '. ' + s.prompt + '\n';
}
await writeFile('SHOTLIST.md', out); console.log('wrote SHOTLIST.md');
