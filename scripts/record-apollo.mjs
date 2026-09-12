import { mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const frames = new URL('../artifacts/apollo-frames/', import.meta.url); await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Man walks on the Moon/i }).click(); await page.locator('.play').click(); await page.locator('.walk-begin').click();
const started = Date.now(); let frame = 0;
while (Date.now() - started < 71_000) {
  const target = started + frame * 250; const wait = target - Date.now(); if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: new URL(`frame-${String(frame).padStart(4, '0')}.jpg`, frames).pathname, type: 'jpeg', quality: 72 }); frame += 1;
}
console.log(`Captured ${frame} Playwright frames`); await browser.close();
