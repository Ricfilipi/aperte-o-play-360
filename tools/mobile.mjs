import puppeteer from 'puppeteer-core';
import { CHROME, SITE } from './chrome.mjs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(SITE, { waitUntil: 'networkidle0' });
await wait(9000);
await page.screenshot({ path: process.argv[2] + '/m-hero.png', fullPage: false });
const overflow = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}));
console.log(JSON.stringify({ overflow, errs }));
await browser.close();
