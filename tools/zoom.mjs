import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
const [src, out, X, Y, W, H, S] = process.argv.slice(2);
const b64 = fs.readFileSync(src).toString('base64');
const mime = src.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage(); await page.goto('about:blank');
const png = await page.evaluate(async (url, x, y, w, h, s) => {
  const img = new Image(); img.src = url; await img.decode();
  const cv = document.createElement('canvas'); cv.width = w*s; cv.height = h*s;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#2A0B36'; c.fillRect(0,0,cv.width,cv.height);
  c.drawImage(img, x, y, w, h, 0, 0, w*s, h*s);
  return cv.toDataURL('image/png');
}, `data:${mime};base64,${b64}`, +X, +Y, +W, +H, +S);
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out);
