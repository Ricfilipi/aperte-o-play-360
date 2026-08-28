/* Drives the running site: waits out the intro, shoots the sections, and
   samples the marquee's transform over time to prove it really drifts.

   Usage: node tools/check.mjs <outDir> [width height] */

import puppeteer from 'puppeteer-core';
import { CHROME, SITE } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const W = +(process.argv[3] ?? 1600);
const H = +(process.argv[4] ?? 900);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('404? ' + r.url()));

await page.goto(SITE, { waitUntil: 'networkidle0' });
await wait(9000);

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('   shot', name);
};

await shot('01-hero');

/* the strip: does it move, and does it keep moving after it scrolls by? */
const readX = () => page.evaluate(() => {
  const t = document.getElementById('marquee');
  const m = new DOMMatrixReadOnly(getComputedStyle(t).transform);
  return { x: +m.m41.toFixed(1), groups: t.children.length, width: t.getBoundingClientRect().width };
});

const before = [];
for (let i = 0; i < 3; i++) { before.push(await readX()); await wait(700); }

await page.evaluate(() => document.querySelector('#catalogo').scrollIntoView());
await wait(2500);
await shot('02-catalogo');

await page.evaluate(() => document.querySelector('#orcamento').scrollIntoView());
await wait(2500);
await shot('03-orcamento');

/* back to the strip and watch it again */
await page.evaluate(() => document.querySelector('.marquee').scrollIntoView({ block: 'center' }));
await wait(2000);
const after = [];
for (let i = 0; i < 3; i++) { after.push(await readX()); await wait(700); }
await shot('04-marquee');

await page.evaluate(() => document.querySelector('#como-funciona').scrollIntoView());
await wait(2000);
await shot('05-como-funciona');

console.log('marquee before scroll:', JSON.stringify(before));
console.log('marquee after  scroll:', JSON.stringify(after));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
