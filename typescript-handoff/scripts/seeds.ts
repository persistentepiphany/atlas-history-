import { mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Writes the seed images that the scenario files name but the asset pack does not carry.
 * Each placeholder is derived from a real image in the pack so the model is anchored to
 * the right tonal range, and each is listed in walkthrough/PLACEHOLDERS.md. Dropping a real
 * photograph at the same path replaces it with no other change.
 */
const ASSETS = join('..', 'walkthrough', 'assets');
const exists = async (p: string) => access(p).then(() => true, () => false);
const W = 1280, H = 720;

async function tone(src: string, dst: string, opts: { grey?: boolean; gamma?: number; tint?: [number, number, number]; blur?: number; region?: { left: number; top: number; width: number; height: number } }) {
  let img = sharp(src);
  if (opts.region) img = img.extract(opts.region);
  img = img.resize(W, H, { fit: 'cover' });
  if (opts.blur) img = img.blur(opts.blur);
  if (opts.grey) img = img.greyscale();
  if (opts.gamma) img = img.gamma(opts.gamma);
  if (opts.tint) img = img.tint({ r: opts.tint[0], g: opts.tint[1], b: opts.tint[2] });
  await img.png().toFile(dst);
  console.log('wrote ' + dst);
}

async function apollo() {
  const ev = join(ASSETS, 'apollo11'); const img = join(ev, 'images'); await mkdir(img, { recursive: true });
  const a04 = join(img, 'a04.png');
  const honeysuckle = join(img, 'honeysuckle-1969.png');
  if (!(await exists(honeysuckle))) await sharp({ create: { width: W, height: H, channels: 3, background: { r: 132, g: 138, b: 128 } } }).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H * 0.55}" fill="#9aa3a6"/><rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="#5d6a4f"/><ellipse cx="${W * 0.5}" cy="${H * 0.5}" rx="${W * 0.16}" ry="${H * 0.26}" fill="#e6e6e2"/><rect x="${W * 0.47}" y="${H * 0.62}" width="${W * 0.06}" height="${H * 0.25}" fill="#c9c9c3"/></svg>`), top: 0, left: 0 }]).blur(2).png().toFile(honeysuckle), console.log('wrote ' + honeysuckle);
  const houston = join(img, 'houston-frame.png');
  if (!(await exists(houston))) await tone(a04, houston, { grey: true, gamma: 1.6, blur: 1.5, tint: [140, 150, 160] });
  const wire = join(img, 'wire-room.png');
  if (!(await exists(wire))) await tone(join(ev, 'pages', 'a02.png'), wire, { grey: true, gamma: 1.2, blur: 6, region: { left: 0, top: 0, width: 2796, height: 1600 } });
}

async function berlin() {
  const ev = join(ASSETS, 'berlin1989'); const img = join(ev, 'images'); await mkdir(img, { recursive: true });
  const regulation = join(img, 'regulation-crop.png');
  const b01 = join(ev, 'pages', 'b01.png'); const m = await sharp(b01).metadata();
  await tone(b01, regulation, { region: { left: Math.round(m.width! * 0.566), top: Math.round(m.height! * 0.455), width: Math.round(m.width! * 0.26), height: Math.round(m.height! * 0.165) }, tint: [232, 214, 176], gamma: 1.1 });
  const bridge = join(img, 'asche-bridge.png');
  if (!(await exists(bridge))) await tone(join(img, 'b05.png'), bridge, { grey: true, gamma: 2.4, blur: 3, tint: [200, 170, 110] });
}

await apollo(); await berlin();
