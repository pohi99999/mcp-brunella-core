const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  await page.goto('https://www.lumenlimitedseries.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Cookie consent elfogadása
  try {
    await page.click('button:has-text("ACCEPT")', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch(e) {}
  
  // Concept szekció kép
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    sections[1]?.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'lumen-concept-img.png', fullPage: false });
  
  // Heritage szekció kép
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    sections[2]?.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'lumen-heritage-img.png', fullPage: false });
  
  // Auth szekció kép
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    sections[3]?.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'lumen-auth-img.png', fullPage: false });
  
  // DOM ellenőrzés - milyen mobilképek vannak
  const result = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => ({
      src: img.src.replace('https://www.lumenlimitedseries.com', ''),
      visible: img.offsetParent !== null,
      classes: img.className.slice(0, 80)
    }));
  });
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
}
check().catch(console.error);
