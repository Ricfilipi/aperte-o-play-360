/* Real-time visual check: drives the local Chrome over CDP, captures the
   hero at rest and mid-transition, and reports any console errors.
   Usage: node shoot.mjs [outDir] */

import puppeteer from 'puppeteer-core';
import { CHROME, SITE } from './chrome.mjs';

const OUT = process.argv[2] || '.';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--window-size=1600,900',
  ],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(SITE, { waitUntil: 'networkidle0' });

// let the intro timeline finish
await wait(9000);

// freeze autoplay so the rest is deterministic
await page.evaluate(() => {
  for (let i = 1; i < 100000; i++) clearInterval(i);
});
await wait(400);

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await shot('hero-rest');

// measure the hero garment so we can tell "invisible" from "off-screen"
const metrics = await page.evaluate(() => {
  const j = document.querySelector('#heroSlot .product');
  if (!j) return { found: false };
  const r = j.getBoundingClientRect();
  const cs = getComputedStyle(j);
  return {
    found: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    opacity: cs.opacity,
    filter: cs.filter,
    transform: cs.transform,
    id: j.dataset.id,
    railIds: [...document.querySelectorAll('.rail-slot .product')].map((e) => e.dataset.id),
    produto: document.getElementById('productName').textContent,
    scrollHeight: document.body.scrollHeight,
  };
});

// trigger one transition and sample it mid-flight
await page.click('#next');
await wait(420);
await shot('hero-mid');
await wait(1400);
await shot('hero-after');

const after = await page.evaluate(() => {
  const j = document.querySelector('#heroSlot .product');
  return {
    id: j?.dataset.id,
    opacity: j ? getComputedStyle(j).opacity : null,
    filter: j ? getComputedStyle(j).filter : null,
    railIds: [...document.querySelectorAll('.rail-slot .product')].map((e) => e.dataset.id),
    produto: document.getElementById('productName').textContent,
  };
});

// walk the page in steps, stopping when each section reaches the top
for (const [name, sel] of [['como-funciona','#como-funciona'],['catalogo','#catalogo'],['orcamento','#orcamento']]) {
  for (let guard = 0; guard < 400; guard++) {
    const top = await page.evaluate((q) => document.querySelector(q).getBoundingClientRect().top, sel);
    if (top <= 60) break;
    await page.evaluate((d) => scrollBy(0, d), Math.min(300, Math.max(60, top)));
    await wait(40);
  }
  await wait(2500);
  await shot('sec-' + name);
  console.log(name, '-> palette:', await page.evaluate(() => document.body.dataset.palette));
}

console.log(JSON.stringify({ metrics, after, errors }, null, 2));
await browser.close();
