/* Samples the incoming garment's box every ~90ms across one colorway
   change, so we can prove the Flip actually interpolates. */

import puppeteer from 'puppeteer-core';
import { CHROME, SITE } from './chrome.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(SITE, { waitUntil: 'networkidle0' });
await wait(9000);
await page.evaluate(() => { for (let i = 1; i < 100000; i++) clearInterval(i); });
await wait(300);

const samples = await page.evaluate(async () => {
  const nextId = () => {
    const ids = [...document.querySelectorAll('.rail-slot .product')].map((e) => e.dataset.id);
    return ids[0];
  };
  const target = nextId();
  const el = () => document.querySelector(`.product[data-id="${target}"]`);

  const out = [];
  const snap = (t) => {
    const r = el().getBoundingClientRect();
    out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) });
  };

  const t0 = performance.now();
  snap(0);
  document.getElementById('next').click();

  await new Promise((done) => {
    const id = setInterval(() => {
      const t = Math.round(performance.now() - t0);
      snap(t);
      if (t > 1500) { clearInterval(id); done(); }
    }, 90);
  });

  return { target, out };
});

console.log('target:', samples.target);
console.log(samples.out.map((s) => `${String(s.t).padStart(5)}ms  x=${String(s.x).padStart(5)}  y=${String(s.y).padStart(4)}  w=${String(s.w).padStart(4)}`).join('\n'));
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
