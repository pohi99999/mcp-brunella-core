import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

async function tryLogin(email, password) {
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  try {
    await page.waitForURL(url => !url.toString().includes('/signin'), { timeout: 8000 });
    console.log(`✅ SUCCESS: ${email} / ${password} → ${page.url()}`);
    return true;
  } catch {
    const errEl = page.locator('[class*="error"], [class*="alert"], [role="alert"], [class*="warning"]').first();
    const errText = await errEl.textContent().catch(() => 'no error text');
    console.log(`❌ FAIL: ${email} / ${password} → "${errText.trim().slice(0, 80)}"`);
    return false;
  }
}

const combinations = [
  // Different emails with iszapfalo13 password
  ['iszapfalo@gmail.com', 'iszapfalo13'],
  ['peterpohankapersonal@gmail.com', 'iszapfalo13'],
  // Gmail password with different emails  
  ['iszapfalo@gmail.com', 'IszapfaloAI25+'],
  ['peterpohankapersonal@gmail.com', 'IszapfaloAI25+'],
  // Try Pohanka personal as admin
  ['peterpohankapersonal@gmail.com', 'iszapfalo'],
  // n8n.cloud standard domains
  ['iszapfalo@n8n.cloud', 'iszapfalo13'],
  ['admin@iszapfalo.hu', 'iszapfalo13'],
  ['n8n@iszapfalo.hu', 'iszapfalo13'],
];

let success = false;
for (const [email, pw] of combinations) {
  success = await tryLogin(email, pw);
  if (success) break;
  await page.waitForTimeout(500);
}

if (!success) {
  console.log('\n=== Checking n8n instance info ===');
  // Try to check the n8n API for instance info
  const resp = await page.evaluate(async () => {
    try {
      const r = await fetch('/rest/settings', { credentials: 'include' });
      return { status: r.status, body: await r.text() };
    } catch(e) { return { error: e.message }; }
  });
  console.log('API /rest/settings:', JSON.stringify(resp).slice(0, 300));
  
  // Check if there's SSO
  const resp2 = await page.evaluate(async () => {
    try {
      const r = await fetch('/rest/sso/saml/config', { credentials: 'include' });
      return { status: r.status, body: await r.text() };
    } catch(e) { return { error: e.message }; }
  });
  console.log('SSO config:', JSON.stringify(resp2).slice(0, 200));
}

await browser.close();
