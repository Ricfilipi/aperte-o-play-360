/* The supplied logo is a circular badge sitting on an opaque near-black
   square. On the site's own dark gradient the square reads as a sticker, so
   find the badge, cut it out with an anti-aliased circular mask and write a
   square PNG the mark can be dropped anywhere.

   Usage: node tools/logo-round.mjs <logo.png> <out.png> [scale] */

import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';

const [SRC, OUT, SCALE] = process.argv.slice(2);
const b64 = fs.readFileSync(SRC).toString('base64');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
await page.goto('about:blank');

const res = await page.evaluate(async (url, scale) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0);
  const px = c.getImageData(0, 0, w, h).data;

  /* the badge is everything brighter than the surrounding matte */
  const lum = (p) => (px[p * 4] + px[p * 4 + 1] + px[p * 4 + 2]) / 3;
  let corner = 0;
  for (const p of [0, w - 1, (h - 1) * w, h * w - 1]) corner += lum(p);
  corner /= 4;
  const cut = corner + 14;

  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum(y * w + x) <= cut) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = Math.min(x1 - x0, y1 - y0) / 2;

  /* square crop around the badge, a hair wider than the ring */
  const R = r * 1.03;
  const side = Math.round(R * 2);
  const out = document.createElement('canvas');
  out.width = Math.round(side * scale);
  out.height = Math.round(side * scale);
  const o = out.getContext('2d', { willReadFrequently: true });
  o.imageSmoothingQuality = 'high';
  o.drawImage(img, cx - R, cy - R, side, side, 0, 0, out.width, out.height);

  const d = o.getImageData(0, 0, out.width, out.height);
  const mid = out.width / 2;
  const edge = mid - 1;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const dist = Math.hypot(x + 0.5 - mid, y + 0.5 - mid);
      const a = Math.min(1, Math.max(0, edge + 0.5 - dist));
      d.data[(y * out.width + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  o.putImageData(d, 0, 0);

  return { png: out.toDataURL('image/png'), box: [x0, y0, x1, y1], size: [out.width, out.height] };
}, `data:image/png;base64,${b64}`, SCALE ? +SCALE : 3);

fs.writeFileSync(OUT, Buffer.from(res.png.split(',')[1], 'base64'));
console.log(`badge box ${res.box.join(',')} -> ${res.size.join('x')}  ${OUT}`);
await browser.close();
