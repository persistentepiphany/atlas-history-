import { readFile, writeFile } from 'node:fs/promises';
const fmt = (t: number) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
let out = '# Shot list\n\nPrinted from the scenario files by npm run shotlist.\n';
for (const id of ['apollo11', 'berlin1989']) {
  const sc = JSON.parse(await readFile('scenarios/' + id + '.json', 'utf8')) as { title: string; beats: { t: number; phase: string; voice?: { id: string; text: string }; caption?: { text: string }; camera?: { z?: number } }[]; stops: { t: number; label: string; text: string }[] };
  out += '\n## ' + sc.title + '\n\n| T | Phase | Camera z | Spoken |\n|---|---|---|---|\n';
  for (const b of sc.beats) out += '| ' + fmt(b.t) + ' | ' + b.phase + ' | ' + (b.camera?.z ?? '') + ' | ' + (b.voice ? b.voice.id + ', ' + b.voice.text : b.caption?.text ?? '') + ' |\n';
  out += '\nWorld stops\n\n'; for (const s of sc.stops) out += '- ' + fmt(s.t) + ' ' + s.label + '. ' + s.text + '\n';
}
await writeFile('SHOTLIST.md', out); console.log(out);
