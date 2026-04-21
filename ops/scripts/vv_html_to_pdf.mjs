/**
 * VIKTORIAVARGA — HTML → PDF Konverter
 * Playwright Chromium alapú, pixel-pontos PDF generálás
 * Futtatás: node scripts/vv_html_to_pdf.mjs
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const HTML_FILE = 'G:/Brunella/.000_PROJEKTEK/009_Varga_Viktória_prez/_VV/ajanlat_premium_v2.html';
const PDF_FILE  = 'G:/Brunella/.000_PROJEKTEK/009_Varga_Viktória_prez/_VV/ajanlat_premium_v2.pdf';

async function htmlToPdf() {
  if (!fs.existsSync(HTML_FILE)) {
    console.error('[HIBA] A forras HTML fajl nem talalhato:', HTML_FILE);
    process.exit(1);
  }

  console.log('[OK] Chromium indul...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // A4 szelessegnek megfeleloen
  await page.setViewportSize({ width: 900, height: 1200 });

  const fileUrl = `file:///` + HTML_FILE.replace(/\\/g, '/');
  console.log('[OK] HTML betoltes:', fileUrl);

  await page.goto(fileUrl, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  // Extra varakozas a Google Fonts teljes renderelesehez
  await page.waitForTimeout(2500);

  console.log('[OK] Fontok betoltve, PDF generalas...');

  await page.pdf({
    path: PDF_FILE,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
    preferCSSPageSize: true,
  });

  await browser.close();

  const sizeKb = Math.round(fs.statSync(PDF_FILE).size / 1024);
  console.log(`[OK] PDF elkeszult: ${PDF_FILE}`);
  console.log(`[OK] Fajl meret: ${sizeKb} KB`);
}

htmlToPdf().catch(err => {
  console.error('[HIBA]', err.message);
  process.exit(1);
});
