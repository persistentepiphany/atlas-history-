import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { execa } from 'execa';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import cuts from './cuts.json' with { type: 'json' };

const RAW = 'raw'; const OUT = 'public/assets/events'; const LIB = 'public/assets/library';
const placeholders: string[] = [];
const exists = async (p: string) => access(p).then(() => true, () => false);
const ensure = (p: string) => mkdir(p, { recursive: true });

async function pageImage(src: string, dst: string, height: number, dzi = false) {
  await ensure(join(dst, '..'));
  const img = sharp(src, { limitInputPixels: false }).resize({ height }).jpeg({ quality: 90 });
  await img.toFile(dst);
  if (dzi) await sharp(dst).tile({ size: 256, layout: 'dz' }).toFile(dst.replace(/\.jpg$/, '.dzi'));
}
async function pdfPage(src: string, dst: string, dpi: number) {
  await ensure(join(dst, '..'));
  await execa('pdftoppm', ['-r', String(dpi), '-f', '1', '-l', '1', '-jpeg', '-singlefile', src, dst.replace(/\.jpg$/, '')]);
}
async function wordBoxes(pdf: string, dst: string) {
  const data = new Uint8Array(await readFile(pdf));
  const doc = await pdfjs.getDocument({ data }).promise; const page = await doc.getPage(1); const vp = page.getViewport({ scale: 1 }); const tc = await page.getTextContent();
  const words: { w: string; x: number; y: number; width: number; height: number; conf: number }[] = [];
  for (const it of tc.items) {
    if (!('str' in it) || !it.str.trim()) continue; const [, b, , d, e, f] = it.transform as number[]; const h = Math.hypot(b!, d!) || it.height; const parts = it.str.split(/\s+/).filter(Boolean); let x = e!; const n = it.str.length;
    for (const p of parts) { const pw = it.width * (p.length / n); words.push({ w: p, x: x / vp.width, y: 1 - (f! + h) / vp.height, width: pw / vp.width, height: h / vp.height, conf: 1 }); x += it.width * ((p.length + 1) / n); }
  }
  await writeFile(dst, JSON.stringify(words));
}
async function cut(src: string, dst: string, start: number, end: number) {
  await ensure(join(dst, '..'));
  await execa('ffmpeg', ['-y', '-ss', String(start), '-to', String(end), '-i', src, '-af', 'highpass=f=120,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', dst]);
}
async function silence(dst: string, seconds: number) { await ensure(join(dst, '..')); await execa('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(seconds), dst]); placeholders.push(dst + ' silence ' + seconds + ' s'); }
async function noise(dst: string, seconds: number, gainDb: number, filter: string) { await ensure(join(dst, '..')); await execa('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anoisesrc=r=48000:c=pink:a=0.5', '-t', String(seconds), '-af', filter + ',volume=' + gainDb + 'dB', dst]); placeholders.push(dst + ' generated noise'); }
async function greyFrame(dst: string, w: number, h: number, label: string) { await ensure(join(dst, '..')); await sharp({ create: { width: w, height: h, channels: 3, background: '#7a7a78' } }).jpeg().toFile(dst); placeholders.push(dst + ' ' + label); }
async function darkVideo(dst: string) { await ensure(join(dst, '..')); await execa('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x060504:s=1280x720:r=24', '-t', '45', '-vf', 'noise=alls=12:allf=t', '-pix_fmt', 'yuv420p', dst]); placeholders.push(dst + ' dark grain video'); }

async function apollo() {
  const ev = join(OUT, 'apollo11'); const pages = join(ev, 'pages');
  const canberra = join(RAW, 'canberra-times-1969-07-22.jp2'); const la = join(RAW, 'la-times-1969-07-21.jp2');
  if (await exists(canberra)) { await pageImage(canberra, join(pages, 'a01.jpg'), 8192, true); if (await exists(la)) await pageImage(la, join(pages, 'a03.jpg'), 8192); }
  else if (await exists(la)) { await pageImage(la, join(pages, 'a01.jpg'), 8192, true); placeholders.push('a01 is the LA Times page until the Canberra scan arrives'); }
  else placeholders.push('a01 and a03 missing, no page scan in raw');
  const laPdf = join(RAW, 'Moon Landing LA Times 7-21-69_text.pdf'); if (await exists(laPdf)) await wordBoxes(laPdf, join(pages, 'a01.words.json'));
  const wapo = join(RAW, '413651-moon-landing-story-a1-washington-post-1969.pdf'); if (await exists(wapo)) { await pdfPage(wapo, join(pages, 'a02.jpg'), 300); await wordBoxes(wapo, join(pages, 'a02.words.json')); }
  const memo = join(RAW, 'rn100-6-1-2.pdf'); if (await exists(memo)) { await pdfPage(memo, join(pages, 'a05.jpg'), 300); await wordBoxes(memo, join(pages, 'a05.words.json')); }
  if (await exists(join(pages, 'a02.jpg'))) { const m = await sharp(join(pages, 'a02.jpg')).metadata(); await ensure(join(ev, 'images')); await sharp(join(pages, 'a02.jpg')).extract({ left: Math.round(m.width! * 0.015), top: Math.round(m.height! * 0.08), width: Math.round(m.width! * 0.715), height: Math.round(m.height! * 0.51) }).resize({ width: 2048 }).toFile(join(ev, 'images', 'a04.jpg')); }
  await greyFrame(join(ev, 'images', 'g01.jpg'), 2048, 1536, 'G01 onboard photograph');
  const reel = join(RAW, 'Apollo11Highlights.mp3');
  for (const id of ['N01', 'N02', 'N03', 'N04', 'N05'] as const) { const c = cuts[id]; const dst = join(ev, 'audio', id.toLowerCase() + '.wav'); if (await exists(reel)) await cut(reel, dst, c.start, c.end); else await silence(dst, c.end - c.start); }
  for (let i = 1; i <= 5; i++) { const src = join(RAW, '11_highlight_' + i + '.mp3'); const dst = join(ev, 'audio', 'onboard-' + i + '.wav'); if (await exists(src)) await execa('ffmpeg', ['-y', '-i', src, '-ar', '48000', dst]); else await silence(dst, 20); }
  for (let i = 1; i <= 13; i++) await silence(join(ev, 'audio', 'v01-' + String(i).padStart(2, '0') + '.wav'), 6);
  await silence(join(ev, 'audio', 'v02.wav'), 20); await silence(join(ev, 'audio', 'v03.wav'), 5);
  if (await exists(join(pages, 'a01.words.json'))) { const words = JSON.parse(await readFile(join(pages, 'a01.words.json'), 'utf8')) as { w: string }[]; const lead = words.slice(3, 55); await writeFile(join(ev, 'audio', 'v02.align.json'), JSON.stringify(lead.map((w, i) => ({ w: w.w, start: (20 * i) / lead.length, end: (20 * (i + 0.9)) / lead.length })))); placeholders.push('v02.align.json spreads the lead evenly over 20 s of silence'); }
  await darkVideo(join(ev, 'video', 'r01.mp4'));
  await writeFile(join(ev, 'manifest.json'), JSON.stringify(manifest('apollo11'), null, 2));
}
async function berlin() {
  const ev = join(OUT, 'berlin1989'); const pages = join(ev, 'pages');
  const nd10 = join(RAW, 'SNP2532889X-19891110-0-1-0-0.pdf'); const nd11 = join(RAW, 'SNP2532889X-19891111-0-1-0-0.pdf');
  if (await exists(nd10)) await pdfPage(nd10, join(pages, 'b01.jpg'), 300); else placeholders.push('b01 missing');
  if (await exists(nd11)) await pdfPage(nd11, join(pages, 'b02.jpg'), 300); else placeholders.push('b02 missing');
  await greyFrame(join(pages, 'b03.jpg'), 1440, 2016, 'B03 Tagesspiegel'); await greyFrame(join(pages, 'b04.jpg'), 1440, 2016, 'B04 NYT'); await greyFrame(join(ev, 'images', 'b05.jpg'), 2048, 1536, 'B05 press conference still');
  await writeFile(join(pages, 'b01.words.json'), '[]'); placeholders.push('b01.words.json empty, Tesseract deu pass pending');
  for (let i = 1; i <= 10; i++) await silence(join(ev, 'audio', 'w01-' + String(i).padStart(2, '0') + '.wav'), 6);
  await silence(join(ev, 'audio', 'w02.wav'), 24); await writeFile(join(ev, 'audio', 'w02.align.json'), '[]'); await silence(join(ev, 'audio', 'w03.wav'), 8);
  for (const k of ['k01', 'k02', 'k03']) await silence(join(ev, 'audio', k + '.wav'), 10);
  await darkVideo(join(ev, 'video', 'r02.mp4'));
  await writeFile(join(ev, 'manifest.json'), JSON.stringify(manifest('berlin1989'), null, 2));
}
async function library() {
  await noise(join(LIB, 'foley', 'f01.wav'), 0.35, -12, 'bandpass=f=900:w=600'); await noise(join(LIB, 'foley', 'f02.wav'), 0.6, -12, 'bandpass=f=1200:w=1600');
  await noise(join(LIB, 'foley', 'f03.wav'), 3, -14, 'bandpass=f=2400:w=400,tremolo=f=14:d=0.9'); await noise(join(LIB, 'foley', 'f04.wav'), 20, -24, 'lowpass=f=1400');
  await noise(join(LIB, 'beds', 'b01.wav'), 60, -30, 'lowpass=f=1800,afade=t=in:d=2,afade=t=out:st=58:d=2');
}
function manifest(event: string) {
  const today = new Date().toISOString().slice(0, 10);
  const a = (id: string, path: string, medium: string, source: string, layer: 'deterministic' | 'generated' | 'synthetic', processing: string, rights = 'In copyright, educational use, not for redistribution') => ({ id, path, medium, source, fetched: today, fetch_method: 'manual', rights, processing, layer });
  return event === 'apollo11' ? { event, assets: [
    a('A01', 'events/apollo11/pages/a01.jpg', 'page-image', 'Trove, National Library of Australia', 'deterministic', 'sharp resize 8192 tall, JPEG q90, dz tiles'),
    a('A02', 'events/apollo11/pages/a02.jpg', 'page-image', 'Internet Archive, Washington Post A1', 'deterministic', 'pdftoppm 300 dpi'),
    a('A04', 'events/apollo11/images/a04.jpg', 'image', 'Derived from A02 photograph', 'deterministic', 'crop 2048 px'),
    a('A05', 'events/apollo11/pages/a05.jpg', 'page-image', 'National Archives, Safire memo', 'deterministic', 'pdftoppm 300 dpi', 'Public domain'),
    a('G01', 'events/apollo11/images/g01.jpg', 'image', 'Placeholder', 'generated', 'mid grey frame'),
    a('N01', 'events/apollo11/audio/n01.wav', 'audio', 'Internet Archive, Apollo 11 highlights', 'deterministic', 'ffmpeg trim, highpass 120', 'Public domain'),
    a('R01', 'events/apollo11/video/r01.mp4', 'video', 'Placeholder', 'generated', 'ffmpeg dark grain 45 s'),
    a('B01', 'library/beds/b01.wav', 'audio', 'Generated', 'synthetic', 'pink noise lowpass 1800'),
  ] } : { event, assets: [
    a('B01', 'events/berlin1989/pages/b01.jpg', 'page-image', 'ZEFYS, Staatsbibliothek zu Berlin', 'deterministic', 'pdftoppm 300 dpi'),
    a('B02', 'events/berlin1989/pages/b02.jpg', 'page-image', 'ZEFYS, Staatsbibliothek zu Berlin', 'deterministic', 'pdftoppm 300 dpi'),
    a('B05', 'events/berlin1989/images/b05.jpg', 'image', 'Placeholder', 'generated', 'mid grey frame'),
    a('R02', 'events/berlin1989/video/r02.mp4', 'video', 'Placeholder', 'generated', 'ffmpeg dark grain 45 s'),
  ] };
}
await apollo(); await berlin(); await library();
await writeFile('PLACEHOLDERS.md', '# Placeholders\n\nGenerated by scripts/prepare-assets.ts. Each line names a file that stands in for an asset not present in raw. Dropping the real file into raw and rerunning npm run assets replaces it.\n\n' + placeholders.map((p) => '- ' + p).join('\n') + '\n');
console.log('prepared, placeholders', placeholders.length);
