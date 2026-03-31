import { chromium } from '@playwright/test';

async function check() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const page = await context.newPage();
  await page.goto('https://www.lumenlimitedseries.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  try {
    await page.click('button:has-text("ACCEPT")', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch(e) {}
  
  // Heritage szekció ImageFrame képe
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    if (sections[2]) sections[2].scrollIntoView({ behavior: 'instant', block: 'end' });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'lumen-heritage-frame.png', fullPage: false });
  
  // DOM: képek listája
  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.getAttribute('src') || '',
      style: img.getAttribute('style') || '',
      class: img.className.slice(0, 100),
      visible: window.getComputedStyle(img).display !== 'none'
    }));
  });
  console.log(JSON.stringify(imgs, null, 2));
  
  await browser.close();
}
check().catch(console.error);
