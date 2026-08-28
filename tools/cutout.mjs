/* Background removal without native deps: Chrome decodes the file, a canvas
   removes the backdrop, the alpha edge is feathered, and the result is
   trimmed to the subject and written as PNG.

   Usage: node tools/cutout.mjs <srcDir> <outDir>

   modes
     checker  the "fake transparency" grey chequerboard. Keyed by range,
              not by a single colour: anything achromatic and brighter than
              `lo` and reachable from the border is backdrop. That survives
              the JPEG blur between squares, which a single-colour key does
              not. `lo` is derived from the darkest border tone unless set.
     alpha    the file already carries real alpha — just trim it.
     portrait a plain square crop, no keying.
*/

import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

/* `maxHole` is the largest bounding box (px) an enclosed background pocket
   may have and still be punched out. Netting encloses thousands of small
   cells the border flood fill can never reach; a ladder rail is long and
   thin, so a square limit tells the two apart. */
const JOBS = [
  { file: '360.jpg', out: 'cabine-360.png', mode: 'checker', chroma: 72, erode: 1, feather: 1.2, maxHole: 40 },
  { file: 'CAMA ELASTICA.jpg', out: 'cama-elastica.png', mode: 'checker', chroma: 14, erode: 1, feather: 1.2, maxHole: 100000 },
  { file: 'piscina de bolinhas.jpg', out: 'piscina-de-bolinhas.png', mode: 'checker', chroma: 14, erode: 1, feather: 1.2, maxHole: 70 },
  { file: 'DRONE.png', out: 'drone.png', mode: 'alpha' },
  { file: 'contato.jpeg', out: 'contato.png', mode: 'portrait', crop: [0.103, 0.212, 0.633, 0.610] },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const job of JOBS) {
  const ext = path.extname(job.file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const b64 = fs.readFileSync(path.join(SRC, job.file)).toString('base64');

  const result = await page.evaluate(
    async (dataUrl, opts) => {
      const { mode, chroma, erode, feather, crop, maxHole, lo: loOpt } = opts;

      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;

      const box = crop
        ? [crop[0] * sw, crop[1] * sh, (crop[2] - crop[0]) * sw, (crop[3] - crop[1]) * sh].map(Math.round)
        : [0, 0, sw, sh];
      const w = box[2];
      const h = box[3];

      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, box[0], box[1], w, h, 0, 0, w, h);

      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;

      if (mode === 'portrait') {
        return { png: cv.toDataURL('image/png'), size: [w, h], source: [sw, sh], note: 'crop only' };
      }

      const visited = new Uint8Array(w * h);
      let lo = loOpt ?? 0;

      if (mode === 'alpha') {
        for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] < 24) visited[p] = 1;
      } else {
        /* darkest achromatic tone on the border sets the floor */
        if (!loOpt) {
          let darkest = 255;
          const scan = (x, y) => {
            const i = (y * w + x) * 4;
            const mx = Math.max(px[i], px[i + 1], px[i + 2]);
            const mn = Math.min(px[i], px[i + 1], px[i + 2]);
            if (mx - mn <= chroma) darkest = Math.min(darkest, mn);
          };
          for (let x = 0; x < w; x++) { scan(x, 0); scan(x, h - 1); }
          for (let y = 0; y < h; y++) { scan(0, y); scan(w - 1, y); }
          lo = Math.max(0, darkest - 14);
        }

        const isBack = (i) => {
          const mx = Math.max(px[i], px[i + 1], px[i + 2]);
          const mn = Math.min(px[i], px[i + 1], px[i + 2]);
          return mx - mn <= chroma && mn >= lo;
        };

        const stack = [];
        for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
        for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
        while (stack.length) {
          const y = stack.pop();
          const x = stack.pop();
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const p = y * w + x;
          if (visited[p] || !isBack(p * 4)) continue;
          visited[p] = 1;
          stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }

        /* punch out the backdrop pockets the border fill could not reach —
           every cell of a net is enclosed by its own threads */
        if (maxHole) {
          const seen = new Uint8Array(w * h);
          for (let p0 = 0; p0 < w * h; p0++) {
            if (visited[p0] || seen[p0] || !isBack(p0 * 4)) continue;
            const cell = [];
            const q = [p0];
            seen[p0] = 1;
            let x0 = w, y0 = h, x1 = -1, y1 = -1;
            while (q.length) {
              const p = q.pop();
              cell.push(p);
              const x = p % w, y = (p / w) | 0;
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
              const push = (nx, ny) => {
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                const np = ny * w + nx;
                if (seen[np] || visited[np] || !isBack(np * 4)) return;
                seen[np] = 1;
                q.push(np);
              };
              push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
            }
            if (x1 - x0 + 1 <= maxHole && y1 - y0 + 1 <= maxHole) {
              for (const p of cell) visited[p] = 1;
            }
          }
        }
      }

      /* grow the removed region so the anti-aliased rim goes with it */
      for (let step = 0; step < (erode ?? 0); step++) {
        const grown = visited.slice();
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            if (visited[p]) continue;
            if (
              (x > 0 && visited[p - 1]) || (x < w - 1 && visited[p + 1]) ||
              (y > 0 && visited[p - w]) || (y < h - 1 && visited[p + w])
            ) grown[p] = 1;
          }
        }
        visited.set(grown);
      }

      const alpha = new Float32Array(w * h);
      for (let p = 0; p < w * h; p++) alpha[p] = visited[p] ? 0 : 255;

      const r = Math.max(1, Math.round(feather ?? 1));
      const soft = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, count = 0;
          for (let dy = -r; dy <= r; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            for (let dx = -r; dx <= r; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= w) continue;
              sum += alpha[yy * w + xx]; count++;
            }
          }
          soft[y * w + x] = sum / count;
        }
      }

      let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
      for (let p = 0; p < w * h; p++) {
        const a = Math.min(soft[p], px[p * 4 + 3]);
        px[p * 4 + 3] = a;
        if (a > 12) {
          kept++;
          const x = p % w, y = (p / w) | 0;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      ctx.putImageData(data, 0, 0);
      if (maxX < 0) return { error: 'everything was removed' };

      const pad = Math.round(Math.max(w, h) * 0.02);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      const tw = maxX - minX + 1;
      const th = maxY - minY + 1;

      const out = document.createElement('canvas');
      out.width = tw; out.height = th;
      out.getContext('2d').drawImage(cv, minX, minY, tw, th, 0, 0, tw, th);

      return {
        png: out.toDataURL('image/png'),
        size: [tw, th],
        source: [sw, sh],
        note: mode === 'alpha' ? 'trimmed existing alpha' : `lo=${lo}`,
        keptPct: +((kept / (w * h)) * 100).toFixed(1),
      };
    },
    `data:${mime};base64,${b64}`,
    job,
  );

  if (result.error) { console.log(job.file, '->', result.error); continue; }
  fs.writeFileSync(path.join(OUT, job.out), Buffer.from(result.png.split(',')[1], 'base64'));
  console.log(
    `${job.file.padEnd(24)} -> ${job.out.padEnd(23)} ${result.source.join('x')} -> ${result.size.join('x')}` +
    `  ${result.note}${result.keptPct !== undefined ? `  kept=${result.keptPct}%` : ''}`,
  );
}

await browser.close();
