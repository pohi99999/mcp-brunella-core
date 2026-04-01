import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

console.log('Starting browser test...');

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
console.log('Browser launched');

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
console.log('Context created');

const page = await ctx.newPage();
console.log('Page created');

try {
  console.log('Navigating to n8n signin...');
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Page loaded, URL:', page.url());
  await page.screenshot({ path: 'tasks/screenshots/test_signin.png' });

  // Check what's on the page
  const title = await page.title();
  console.log('Page title:', title);
  
  const inputs = await page.locator('input').all();
  console.log('Input count:', inputs.length);
  for (const inp of inputs) {
    const type = await inp.getAttribute('type').catch(() => 'unknown');
    const name = await inp.getAttribute('name').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    console.log(`  Input: type=${type} name=${name} placeholder=${placeholder}`);
  }

  // Fill and submit
  await page.fill('input[type="email"], input[name="email"]', 'iszapfalo');
  await page.fill('input[type="password"]', 'iszapfalo13');
  await page.screenshot({ path: 'tasks/screenshots/test_filled.png' });
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'tasks/screenshots/test_after_login.png' });
  console.log('After login URL:', page.url());
  
  console.log('Login test PASSED');
} catch(e) {
  console.error('ERROR:', e.message);
  await page.screenshot({ path: 'tasks/screenshots/test_error.png' }).catch(() => {});
} finally {
  await browser.close();
  console.log('Browser closed');
}
