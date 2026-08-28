/* Confere as duas durações da Plataforma 360 e o item sob consulta. */
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
await page.evaluate(() => { for (let i = 1; i < 100000; i++) clearInterval(i); localStorage.clear(); });

// jump to the 360 via its progress dot
await page.evaluate(() => document.querySelectorAll('.dots button')[0].click());
await wait(1600);

const twoHour = await page.evaluate(() => ({
  name: document.getElementById('productName').textContent,
  tiers: [...document.querySelectorAll('#tiers .tier')].map((b) => b.textContent),
  price: document.getElementById('price').textContent,
}));

await page.evaluate(() => document.querySelectorAll('#tiers .tier')[1].click());
await wait(600);
const fourHour = await page.evaluate(() => document.getElementById('price').textContent);
await page.click('#heroAdd');
await wait(700);

// drone = sob consulta
await page.evaluate(() => document.getElementById('quoteClose').click());
await wait(400);
await page.evaluate(() => document.querySelectorAll('.dots button')[3].click());
await wait(1600);
const drone = await page.evaluate(() => ({
  name: document.getElementById('productName').textContent,
  price: document.getElementById('price').textContent,
}));
await page.click('#heroAdd');
await wait(700);

const out = await page.evaluate(() => ({
  total: document.getElementById('quoteTotal').textContent,
  noteHidden: document.getElementById('quoteNote').hidden,
  msg: decodeURIComponent(document.getElementById('quoteSend').href.split('text=')[1] || ''),
}));

console.log(JSON.stringify({ twoHour, fourHour, drone, out, errors }, null, 2));
await browser.close();
