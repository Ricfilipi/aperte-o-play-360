import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';
const DIR = process.argv[2], OUT = process.argv[3];
const files = fs.readdirSync(DIR).filter(f=>f.endsWith('.png'));
const imgs = files.map(f=>({name:f,url:`data:image/png;base64,${fs.readFileSync(path.join(DIR,f)).toString('base64')}`}));
const browser = await puppeteer.launch({ executablePath: CHROME, headless:true });
const page = await browser.newPage(); await page.goto('about:blank');
const png = await page.evaluate(async (imgs)=>{
  const CELL=520;
  const loaded = await Promise.all(imgs.map(async it=>{const i=new Image();i.src=it.url;await i.decode();return {...it,img:i};}));
  const cv=document.createElement('canvas'); cv.width=CELL*loaded.length; cv.height=CELL+20;
  const c=cv.getContext('2d'); c.fillStyle='#000'; c.fillRect(0,0,cv.width,cv.height);
  loaded.forEach((it,k)=>{
    const t=document.createElement('canvas'); t.width=it.img.naturalWidth; t.height=it.img.naturalHeight;
    const tc=t.getContext('2d',{willReadFrequently:true}); tc.drawImage(it.img,0,0);
    const d=tc.getImageData(0,0,t.width,t.height);
    for(let p=0;p<t.width*t.height;p++){const a=d.data[p*4+3];d.data[p*4]=a;d.data[p*4+1]=a;d.data[p*4+2]=a;d.data[p*4+3]=255;}
    tc.putImageData(d,0,0);
    const s=Math.min(CELL/t.width,CELL/t.height);
    c.drawImage(t,k*CELL+(CELL-t.width*s)/2,(CELL-t.height*s)/2,t.width*s,t.height*s);
    c.fillStyle='#0f0'; c.font='13px sans-serif'; c.fillText(it.name,k*CELL+10,CELL+14);
  });
  return cv.toDataURL('image/png');
}, imgs);
fs.writeFileSync(OUT, Buffer.from(png.split(',')[1],'base64'));
console.log('wrote',OUT);
await browser.close();
