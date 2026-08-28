/* Reports the border colours of each source image so the cutout thresholds
   can be chosen from data instead of guesswork. */

import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const file of fs.readdirSync(SRC)) {
  const ext = path.extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const b64 = fs.readFileSync(path.join(SRC, file)).toString('base64');

  const info = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, w, h).data;

    /* how much real alpha is already in the file */
    let transparent = 0;
    for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] < 250) transparent++;

    /* cluster the border ring into up to 3 buckets */
    const border = [];
    const take = (x, y) => {
      const i = (y * w + x) * 4;
      border.push([px[i], px[i + 1], px[i + 2], px[i + 3]]);
    };
    for (let x = 0; x < w; x += 2) { take(x, 0); take(x, h - 1); }
    for (let y = 0; y < h; y += 2) { take(0, y); take(w - 1, y); }

    const buckets = [];
    for (const c of border) {
      const hit = buckets.find((b) => Math.hypot(b.c[0] - c[0], b.c[1] - c[1], b.c[2] - c[2]) < 26);
      if (hit) { hit.n++; hit.sum = hit.sum.map((v, k) => v + c[k]); hit.c = hit.sum.map((v) => Math.round(v / hit.n)); }
      else buckets.push({ c: c.slice(0, 3), sum: c.slice(0, 3), n: 1 });
    }
    buckets.sort((a, b) => b.n - a.n);

    return {
      size: [w, h],
      transparentPct: +((transparent / (w * h)) * 100).toFixed(1),
      borderColors: buckets.slice(0, 3).map((b) => ({ rgb: b.c, pct: +((b.n / border.length) * 100).toFixed(1) })),
    };
  }, `data:${mime};base64,${b64}`);

  console.log(
    `${file.padEnd(26)} ${String(info.size.join('x')).padEnd(11)} alpha=${String(info.transparentPct).padStart(5)}%  ` +
    info.borderColors.map((b) => `rgb(${b.rgb.join(',')}) ${b.pct}%`).join('  |  '),
  );
}

await browser.close();
