/* Exercita o fluxo de orçamento: adiciona itens, confere o total e lê o
   link do WhatsApp que seria aberto. */

import puppeteer from 'puppeteer-core';
import { CHROME, SITE } from './chrome.mjs';

const OUT = process.argv[2] || '.';
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(SITE, { waitUntil: 'networkidle0' });
await wait(9000);
await page.evaluate(() => { for (let i = 1; i < 100000; i++) clearInterval(i); });
await wait(400);

const header = await page.evaluate(() => ({
  navItems: [...document.querySelectorAll('.nav a')].map((a) => a.textContent.trim()),
  hasCart: !!document.querySelector('[aria-label="Carrinho"]'),
  quotePill: !!document.getElementById('quotePill'),
}));

/* pick the 4-hour tier on the 360 and add it */
await page.evaluate(() => document.querySelectorAll('#tiers .tier')[1]?.click());
await wait(400);
await page.click('#heroAdd');
await wait(900);
await page.screenshot({ path: `${OUT}/q-drawer.png` });

/* add a second product straight from the catalogue */
await page.evaluate(() => document.getElementById('quoteClose').click());
await wait(500);
await page.evaluate(() => {
  document.querySelector('#catalogo').scrollIntoView();
});
await wait(1600);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.swatch')]
    .find((s) => s.textContent.includes('Piscina'))
    .querySelectorAll('[data-add]');
  btns[0].click();
});
await wait(900);

const quote = await page.evaluate(() => ({
  count: document.getElementById('quoteCount').textContent,
  total: document.getElementById('quoteTotal').textContent,
  lines: [...document.querySelectorAll('.q-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
  sendHref: document.getElementById('quoteSend').href,
  ctaHref: document.getElementById('waCta').href,
  noteHidden: document.getElementById('quoteNote').hidden,
}));

/* the contact portrait */
await page.evaluate(() => document.getElementById('quoteClose').click());
await wait(400);
await page.evaluate(() => document.querySelector('#orcamento').scrollIntoView({ block: 'end' }));
await wait(1800);
await page.screenshot({ path: `${OUT}/q-contato.png` });

console.log(JSON.stringify({ header, quote, errors }, null, 2));
console.log('\nMensagem decodificada:\n' + decodeURIComponent(quote.sendHref.split('text=')[1] || ''));

await browser.close();
