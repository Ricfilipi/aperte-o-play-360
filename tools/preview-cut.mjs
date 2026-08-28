/* Lays the cut-outs over the site's own dark backdrop so the matte can be
   judged the way a visitor sees it. Usage:
     node tools/preview-cut.mjs <dir> <out.png> [bg]  */

import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2];
const OUT = process.argv[3];
const BG = process.argv[4] ?? '#2A0B36';

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));
const imgs = files.map((f) => ({
  name: f,
  url: `data:image/png;base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}`,
}));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
await page.goto('about:blank');

const png = await page.evaluate(async (imgs, bg) => {
  const CELL = 460;
  const loaded = await Promise.all(imgs.map(async (it) => {
    const i = new Image(); i.src = it.url; await i.decode(); return { ...it, img: i };
  }));
  const cv = document.createElement('canvas');
  cv.width = CELL * loaded.length;
  cv.height = CELL + 26;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  loaded.forEach((it, k) => {
    const s = Math.min((CELL - 40) / it.img.naturalWidth, (CELL - 40) / it.img.naturalHeight);
    const dw = it.img.naturalWidth * s, dh = it.img.naturalHeight * s;
    c.drawImage(it.img, k * CELL + (CELL - dw) / 2, 20 + (CELL - 40 - dh) / 2, dw, dh);
    c.fillStyle = '#fff'; c.font = '14px sans-serif';
    c.fillText(`${it.name}  ${it.img.naturalWidth}x${it.img.naturalHeight}`, k * CELL + 12, CELL + 18);
  });
  return cv.toDataURL('image/png');
}, imgs, BG);

fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote', OUT);
await browser.close();
