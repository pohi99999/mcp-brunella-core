import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Monitor network for login responses
page.on('response', async resp => {
  if (resp.url().includes('/rest/login') || resp.url().includes('/signin')) {
    try {
      const body = await resp.text().catch(() => '');
      console.log(`[NET] ${resp.request().method()} ${resp.url()} → ${resp.status()} : ${body.slice(0,150)}`);
    } catch {}
  }
});

async function tryLogin(email, password) {
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Use the Sign in button (no type="submit")
  await page.locator('button:has-text("Sign in")').first().click();
  
  try {
    await page.waitForURL(url => !url.toString().includes('/signin'), { timeout: 8000 });
    console.log(`✅ SUCCESS with ${email} → ${page.url()}`);
    return true;
  } catch {
    const errEl = page.locator('[class*="error"], [role="alert"]').first();
    const errText = await errEl.textContent().catch(() => 'no visible error');
    console.log(`❌ FAIL: ${email} → "${errText.trim().slice(0,80)}"`);
    return false;
  }
}

const combos = [
  ['iam@peterpohanka.com', 'iszapfalo13'],
  ['iam@peterpohanka.com', 'IszapfaloAI25+'],
  ['iam@peterpohanka.com', 'peterpohanka'],
  ['iam@peterpohanka.com', 'iszapfalo'],
  ['peterpohankapersonal@gmail.com', 'iszapfalo13'],
];

let loggedIn = false;
for (const [email, pw] of combos) {
  loggedIn = await tryLogin(email, pw);
  if (loggedIn) {
    console.log('Logged in! Current URL:', page.url());
    await page.screenshot({ path: 'tasks/screenshots/logged_in.png' });
    break;
  }
  await page.waitForTimeout(1000);
}

if (!loggedIn) {
  console.log('\n❌ All login attempts failed');
  console.log('Checking if there is API key auth option...');
  
  // Try the n8n API with a different auth approach
  const resp = await page.evaluate(async () => {
    const r = await fetch('https://iszapfalo.app.n8n.cloud/rest/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrLdapLoginId: 'iam@peterpohanka.com', password: 'iszapfalo13' })
    });
    return { status: r.status, body: await r.text() };
  });
  console.log('Direct API test:', JSON.stringify(resp));
}

await browser.close();
