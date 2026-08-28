/* Onde está o Chrome. Os scripts de verificação dirigem o navegador já
   instalado (puppeteer-core não baixa o seu), então o caminho depende da
   máquina. Defina CHROME_PATH para apontar outro binário:

     CHROME_PATH="/usr/bin/chromium" node tools/shoot.mjs ./shots            */

import fs from 'node:fs';

const CANDIDATOS = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ],
};

function achar() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of CANDIDATOS[process.platform] ?? []) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'Chrome não encontrado. Instale o Google Chrome ou defina CHROME_PATH ' +
      'com o caminho do executável.',
  );
}

export const CHROME = achar();

/** O site precisa estar servido: `npm run preview` antes de rodar as ferramentas. */
export const SITE = process.env.SITE_URL || 'http://localhost:4173/';
