import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'tasks/screenshots/page_inspect.png' });

// Find all interactive elements
const buttons = await page.locator('button').all();
console.log(`Buttons (${buttons.length}):`);
for (const btn of buttons) {
  const text = await btn.textContent().catch(() => '');
  const type = await btn.getAttribute('type').catch(() => '');
  const cls = await btn.getAttribute('class').catch(() => '');
  console.log(`  button type="${type}" class="${cls?.slice(0,50)}" text="${text?.trim().slice(0,50)}"`);
}

const inputs = await page.locator('input').all();
console.log(`\nInputs (${inputs.length}):`);
for (const inp of inputs) {
  const attrs = await inp.evaluate(el => ({
    type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, value: el.value
  }));
  console.log(`  input: ${JSON.stringify(attrs)}`);
}

const forms = await page.locator('form').all();
console.log(`\nForms: ${forms.length}`);
for (const f of forms) {
  const action = await f.getAttribute('action').catch(() => '');
  const method = await f.getAttribute('method').catch(() => '');
  console.log(`  form action="${action}" method="${method}"`);
}

// Check for any element that could be a submit button
const allClickable = await page.locator('[type="submit"], [role="button"], .btn, .button').all();
console.log(`\nAll clickable (${allClickable.length}):`);
for (const el of allClickable.slice(0, 10)) {
  const tag = await el.evaluate(e => e.tagName);
  const text = await el.textContent().catch(() => '');
  const cls = await el.getAttribute('class').catch(() => '');
  console.log(`  ${tag} text="${text?.trim().slice(0,50)}" class="${cls?.slice(0,60)}"`);
}

// Try to fill form and look at network
page.on('request', req => {
  if (req.method() === 'POST') {
    console.log('POST request:', req.url(), req.postData()?.slice(0, 100));
  }
});
page.on('response', resp => {
  if (resp.request().method() === 'POST') {
    console.log('POST response:', resp.url(), resp.status());
  }
});

await page.fill('input[type="email"]', 'iszapfalo@gmail.com');
await page.fill('input[type="password"]', 'iszapfalo13');
await page.screenshot({ path: 'tasks/screenshots/filled_form.png' });

// Try pressing Enter instead of clicking submit
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
await page.screenshot({ path: 'tasks/screenshots/after_enter.png' });
console.log('\nAfter Enter URL:', page.url());

await browser.close();
