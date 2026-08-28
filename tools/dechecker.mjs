/* Turns the "fake transparency" chequerboard baked into a JPEG back into a
   real alpha channel. No native deps: Chrome decodes, a canvas does the work.

   Usage: node tools/dechecker.mjs <srcDir> <outDir>

   Three steps, in this order, because each one cleans up after the last:

   1. Flood the backdrop away by tone. Everything grey and bright that the
      frame's border can reach is backdrop — squares, the blurred seams
      between them, and the faint ghost of a wiped-out element that lifts
      some squares towards white. Keying by tone alone leaves nothing behind,
      which no cleverer local test managed: the seams repeat one cell apart,
      so any "does this alternate?" test reads the grid itself as structure.

   2. Put back what the flood should not have taken. A ladder rail is the
      same grey as a light square, but it is a solid body: split the flooded
      pixels into same-tone islands and give back the ones that survive being
      eroded by two pixels and still run longer than two cells. A square is
      too short, a seam too thin, a rail is neither.

   3. Give the LED halo the alpha its own saturation implies. The backdrop is
      perfectly grey, so whatever colour survives under the halo is the
      halo's own; the grey wash the chequer left in it is divided back out.
*/

import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

const JOBS = [
  { file: '360.jpg', out: 'cabine-360.png', period: 13, chromaScale: 58, chromaFloor: 14 },
  { file: 'cama elastica.jpg', out: 'cama-elastica.png', period: 16, chromaScale: 64, chromaFloor: 16, punchPale: true },
  { file: 'piscina de bolinhas.jpg', out: 'piscina-de-bolinhas.png', period: 16, chromaScale: 58, chromaFloor: 14, punchPale: true },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
await page.goto('about:blank');
page.on('console', (m) => console.log('   [page]', m.text()));

for (const job of JOBS) {
  const ext = path.extname(job.file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(path.join(SRC, job.file)).toString('base64');

  const result = await page.evaluate(
    async (dataUrl, opts) => {
      const { period: P, chromaScale, chromaFloor } = opts;

      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const n = w * h;

      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;

      const gray = new Uint8ClampedArray(n);
      const chroma = new Uint8ClampedArray(n);
      for (let p = 0; p < n; p++) {
        const i = p * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        gray[p] = (r + g + b) / 3;
        chroma[p] = Math.max(r, g, b) - Math.min(r, g, b);
      }

      /* JPEG rings the chequer's own edges; a 3x3 median takes the sting
         out of the saturation reading without touching real colour */
      const chromaMed = new Uint8ClampedArray(n);
      {
        const buf = new Array(9);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let k = 0;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = Math.min(h - 1, Math.max(0, y + dy));
              for (let dx = -1; dx <= 1; dx++) {
                const xx = Math.min(w - 1, Math.max(0, x + dx));
                buf[k++] = chroma[yy * w + xx];
              }
            }
            buf.sort((a, b) => a - b);
            chromaMed[y * w + x] = buf[4];
          }
        }
      }

      /* ---- the two backdrop tones ----
         Read from the pairs themselves, not from a histogram: two grey pixels
         one cell apart that differ by a plausible amount are one light square
         and one dark square. The median over every such pair in the frame
         ignores a flat grey border strip and the subject alike. */
      const mins = [], maxs = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x + P < w; x += 2) {
          const p = y * w + x, q = p + P;
          if (chroma[p] > 12 || chroma[q] > 12) continue;
          const a = gray[p], b = gray[q];
          if (a < 120 || b < 120) continue;
          const d = Math.abs(a - b);
          if (d < 14 || d > 110) continue;
          mins.push(Math.min(a, b));
          maxs.push(Math.max(a, b));
        }
      }
      if (mins.length < 200) return { error: 'no chequerboard found' };
      mins.sort((a, b) => a - b);
      maxs.sort((a, b) => a - b);
      const D = mins[mins.length >> 1];
      const L = maxs[maxs.length >> 1];
      const M = (L + D) / 2;
      const span = L - D;

      /* ---- how strongly does the chequer alternate here? ----
         Compared against its neighbours a cell away along each axis, open
         backdrop reads the full span; a body reads near zero along whichever
         axis it runs. Unreliable on its own — the seams between squares
         repeat one cell apart and fool it — but exact inside a solid body,
         which is the only place it is asked below. */
      const alt = new Float32Array(n);
      {
        const dMin = Math.max(3, Math.round(P * 0.6));
        const dMax = Math.round(P * 1.65);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const g0 = gray[p];
            let best = 1e9;
            for (const [ax, ay] of [[1, 0], [0, 1]]) {
              let axisMax = 0;
              for (let d = dMin; d <= dMax; d++) {
                const dx = ax * d, dy = ay * d;
                let lo = 1e9;
                const xa = x + dx, ya = y + dy;
                if (xa < w && ya < h) lo = Math.abs(g0 - gray[ya * w + xa]);
                const xb = x - dx, yb = y - dy;
                if (xb >= 0 && yb >= 0) lo = Math.min(lo, Math.abs(g0 - gray[yb * w + xb]));
                if (lo !== 1e9 && lo > axisMax) axisMax = lo;
              }
              if (axisMax < best) best = axisMax;
            }
            alt[p] = best === 1e9 ? 0 : best;
          }
        }
      }

      /* ---- 1. flood the backdrop ---- */
      const floor = D - Math.max(12, Math.round(span * 0.35));
      const plausible = new Uint8Array(n);
      for (let p = 0; p < n; p++) plausible[p] = (chromaMed[p] <= 22 && gray[p] >= floor) ? 1 : 0;

      const bg = new Uint8Array(n);
      {
        const q = [];
        const seed = (p) => { if (!bg[p] && plausible[p]) { bg[p] = 1; q.push(p); } };
        for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
        while (q.length) {
          const p = q.pop();
          const x = p % w, y = (p / w) | 0;
          if (x > 0) seed(p - 1);
          if (x < w - 1) seed(p + 1);
          if (y > 0) seed(p - w);
          if (y < h - 1) seed(p + w);
        }
      }

      /* pockets of backdrop the border could not reach — between the legs,
         under the roof, through the rungs, or simply walled off by a ring of
         JPEG colour fringing. A pocket is backdrop if it shows both tones, or
         if what walls it in is itself bright; lettering on a black surface is
         neither, and stays. */
      {
        const seen = new Uint8Array(n);
        for (let p0 = 0; p0 < n; p0++) {
          if (bg[p0] || seen[p0] || !plausible[p0]) continue;
          const cell = [];
          const q = [p0];
          seen[p0] = 1;
          let nearD = 0, nearL = 0, wallSum = 0, wallCount = 0, altSum = 0;
          let graySum = 0, chromaSum = 0;
          const tol = Math.max(6, span * 0.18);
          while (q.length) {
            const p = q.pop();
            cell.push(p);
            if (Math.abs(gray[p] - D) <= tol) nearD++;
            else if (Math.abs(gray[p] - L) <= tol) nearL++;
            altSum += alt[p];
            graySum += gray[p];
            chromaSum += chromaMed[p];
            const x = p % w, y = (p / w) | 0;
            const push = (np) => {
              if (seen[np]) return;
              if (bg[np] || !plausible[np]) { wallSum += gray[np]; wallCount++; return; }
              seen[np] = 1; q.push(np);
            };
            if (x > 0) push(p - 1);
            if (x < w - 1) push(p + 1);
            if (y > 0) push(p - w);
            if (y < h - 1) push(p + w);
          }
          /* Chequerboard if both tones are well represented, or — for a pocket
             the size of a single square, as every cell of a net is — if it
             steps to its neighbours by exactly the span. Lettering on a black
             surface is one tone, and steps to its surroundings by far more. */
          const bothTones = nearD >= cell.length * 0.2 && nearL >= cell.length * 0.2;
          const meanAlt = altSum / cell.length;
          const stepsLikeAChequer = meanAlt >= span * 0.55 && meanAlt <= span * 1.5;
          const wall = wallCount ? wallSum / wallCount : 0;
          /* A large pocket walled in by something dark is lettering or paint
             on the product; one cell of a net is small, and the mesh that
             holds it is not dark. */
          const chequer = stepsLikeAChequer && (cell.length <= P * P * 10 || wall >= D * 0.75);
          /* Where the chequer's contrast has faded to almost nothing, a cell
             of netting reads as one flat pale patch and none of the tests
             above catch it. Opt in per photo: it is only safe where the
             product carries no pale marking of its own. */
          const pale = opts.punchPale
            && cell.length <= P * P * 12
            && graySum / cell.length >= D - 8
            && chromaSum / cell.length <= 12;
          if (bothTones || chequer || pale || wall >= floor - 10) for (const p of cell) bg[p] = 1;
        }
      }

      /* ---- 2. give back the solid grey bodies ---- */
      let rescued = 0;
      {
        const seen = new Uint8Array(n);
        for (let p0 = 0; p0 < n; p0++) {
          if (!bg[p0] || seen[p0]) continue;
          /* one island of near-equal tone; the step between two squares is
             far larger than the tolerance, so squares never merge */
          const cell = [];
          const q = [p0];
          seen[p0] = 1;
          let x0 = w, y0 = h, x1 = -1, y1 = -1, onEdge = false, attached = 0;
          while (q.length) {
            const p = q.pop();
            cell.push(p);
            const x = p % w, y = (p / w) | 0;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1) onEdge = true;
            const g0 = gray[p];
            const push = (np) => {
              if (!plausible[np]) { attached++; return; }
              if (seen[np] || !bg[np]) return;
              if (Math.abs(gray[np] - g0) > 5) return;
              seen[np] = 1; q.push(np);
            };
            if (x > 0) push(p - 1);
            if (x < w - 1) push(p + 1);
            if (y > 0) push(p - w);
            if (y < h - 1) push(p + w);
          }
          /* the frame's own edge is backdrop by definition — one source ends
             in a plain grey band, which is otherwise a perfect "solid body" */
          if (onEdge) continue;
          /* and it has to be part of the product: a rail runs into the frame
             and under the black rungs, while a chain of squares that the soft
             seams happened to join together floats in open backdrop */
          if (attached < 20) continue;
          const long = Math.max(x1 - x0 + 1, y1 - y0 + 1) >= P * 2.5;
          if (!long || cell.length < 200) continue;

          /* thickness: how much of the island is still there after pulling
             the outline in by two pixels. A seam is two pixels wide and has
             none; a square is short; a rail has plenty. */
          const inCell = new Set(cell);
          let core = 0;
          for (const p of cell) {
            const x = p % w, y = (p / w) | 0;
            let solid = true;
            for (let dy = -2; dy <= 2 && solid; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const xx = x + dx, yy = y + dy;
                if (xx < 0 || yy < 0 || xx >= w || yy >= h || !inCell.has(yy * w + xx)) { solid = false; break; }
              }
            }
            if (solid) core++;
          }
          if (core < 30) continue;
          /* an island can drag a whole square in with it — a rail and a light
             square are the same grey. Inside a body the alternation test is
             trustworthy, so let it settle which pixels of the island belong. */
          let given = 0;
          for (const p of cell) if (alt[p] <= span * 0.5) { bg[p] = 0; given++; }
          if (given) rescued++;
        }
      }

      /* ---- 3. alpha ---- */
      const alpha = new Float32Array(n);
      for (let p = 0; p < n; p++) {
        if (bg[p]) continue;
        if (plausible[p]) { alpha[p] = 1; continue; } // enclosed or rescued grey
        const aChr = Math.min(1, Math.max(0, (chromaMed[p] - chromaFloor) / chromaScale));
        const aDark = Math.min(1, Math.max(0, (floor - 2 - gray[p]) / 18));
        alpha[p] = Math.max(aChr, aDark);
      }

      /* ---- specks ---- */
      {
        const solid = new Uint8Array(n);
        for (let p = 0; p < n; p++) solid[p] = alpha[p] > 0.35 ? 1 : 0;
        const seen = new Uint8Array(n);
        for (let p0 = 0; p0 < n; p0++) {
          if (!solid[p0] || seen[p0]) continue;
          const cell = [];
          const q = [p0];
          seen[p0] = 1;
          while (q.length) {
            const p = q.pop();
            cell.push(p);
            const x = p % w, y = (p / w) | 0;
            const push = (np) => { if (!seen[np] && solid[np]) { seen[np] = 1; q.push(np); } };
            if (x > 0) push(p - 1);
            if (x < w - 1) push(p + 1);
            if (y > 0) push(p - w);
            if (y < h - 1) push(p + w);
          }
          if (cell.length < 900) for (const p of cell) alpha[p] = 0;
        }
      }

      /* ---- pull the matte in a pixel so the chequer's anti-aliasing goes
             with it, then soften the cut ---- */
      const eroded = new Float32Array(n);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          let m = alpha[p];
          if (x > 0) m = Math.min(m, alpha[p - 1]);
          if (x < w - 1) m = Math.min(m, alpha[p + 1]);
          if (y > 0) m = Math.min(m, alpha[p - w]);
          if (y < h - 1) m = Math.min(m, alpha[p + w]);
          eroded[p] = m;
        }
      }
      const soft = new Float32Array(n);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let s = 0, c = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              s += eroded[yy * w + xx]; c++;
            }
          }
          soft[y * w + x] = s / c;
        }
      }

      /* ---- divide the grey wash back out, then write the alpha ---- */
      let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
      for (let p = 0; p < n; p++) {
        const a = soft[p];
        const i = p * 4;
        if (a > 0.004 && a < 0.997) {
          for (let k = 0; k < 3; k++) {
            px[i + k] = Math.min(255, Math.max(0, (px[i + k] - (1 - a) * M) / a));
          }
        }
        px[i + 3] = Math.round(a * 255);
        if (a > 0.02) {
          kept++;
          const x = p % w, y = (p / w) | 0;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) return { error: 'everything was removed' };

      /* bleed colour into the clear pixels so scaling cannot pull a halo in */
      const bleed = new Uint8ClampedArray(px);
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            if (bleed[p * 4 + 3] > 6) continue;
            let r = 0, g = 0, b = 0, c = 0;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = y + dy; if (yy < 0 || yy >= h) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx; if (xx < 0 || xx >= w) continue;
                const q = (yy * w + xx) * 4;
                if (bleed[q + 3] <= 6) continue;
                r += bleed[q]; g += bleed[q + 1]; b += bleed[q + 2]; c++;
              }
            }
            if (!c) continue;
            px[p * 4] = r / c; px[p * 4 + 1] = g / c; px[p * 4 + 2] = b / c;
          }
        }
        bleed.set(px);
      }

      ctx.putImageData(data, 0, 0);

      const pad = Math.round(Math.max(w, h) * 0.015);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      const tw = maxX - minX + 1, th = maxY - minY + 1;

      const out = document.createElement('canvas');
      out.width = tw; out.height = th;
      out.getContext('2d').drawImage(cv, minX, minY, tw, th, 0, 0, tw, th);

      return {
        png: out.toDataURL('image/png'),
        size: [tw, th],
        source: [w, h],
        tones: [D, L],
        rescued,
        keptPct: +((kept / n) * 100).toFixed(1),
      };
    },
    `data:${mime};base64,${b64}`,
    job,
  );

  if (result.error) { console.log(job.file, '->', result.error); continue; }
  fs.writeFileSync(path.join(OUT, job.out), Buffer.from(result.png.split(',')[1], 'base64'));
  console.log(
    `${job.file.padEnd(22)} -> ${job.out.padEnd(23)} ${result.source.join('x')} -> ${result.size.join('x')}` +
    `  tones=${result.tones.join('/')}  rescued=${result.rescued}  kept=${result.keptPct}%`,
  );
}

await browser.close();
