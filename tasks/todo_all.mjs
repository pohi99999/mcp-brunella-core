import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

console.log('Starting n8n automation...');

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

async function loginN8n() {
  console.log('Navigating to n8n signin...');
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  console.log('URL:', page.url(), '| Title:', await page.title());

  // Wait for form to render
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.locator('input').all();
  console.log('Inputs found:', inputs.length);
  for (const inp of inputs) {
    const attrs = await inp.evaluate(el => ({ type: el.type, name: el.name, placeholder: el.placeholder, id: el.id }));
    console.log('  Input:', JSON.stringify(attrs));
  }

  await page.screenshot({ path: 'tasks/screenshots/s1_loginform.png' });

  // Fill email/username
  const emailSel = 'input[type="email"], input[name="email"], input[id*="email" i], input[placeholder*="email" i]';
  const emailVisible = await page.locator(emailSel).first().isVisible({ timeout: 5000 }).catch(() => false);
  if (emailVisible) {
    await page.fill(emailSel, 'iszapfalo');
  } else {
    // Try first input
    await page.locator('input').first().fill('iszapfalo');
  }

  const pwSel = 'input[type="password"]';
  await page.fill(pwSel, 'iszapfalo13');

  await page.screenshot({ path: 'tasks/screenshots/s2_filled.png' });

  // Click submit
  const submitSel = 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")';
  await page.locator(submitSel).first().click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/screenshots/s3_after_submit.png' });
  console.log('After login URL:', page.url());

  // Check if logged in
  if (page.url().includes('/signin')) {
    // Maybe need to wait more
    await page.waitForURL(url => !url.toString().includes('/signin'), { timeout: 10000 }).catch(() => {});
    console.log('Final URL:', page.url());
  }
  return !page.url().includes('/signin');
}

async function navigateToCredentials() {
  console.log('Going to credentials...');
  await page.goto('https://iszapfalo.app.n8n.cloud/home/credentials', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tasks/screenshots/s4_credentials.png' });
  console.log('Credentials URL:', page.url());
}

async function findCredential(name) {
  // Try search box
  const searchBox = page.locator('input[placeholder*="search" i], input[type="search"]').first();
  if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBox.clear();
    await searchBox.fill(name);
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `tasks/screenshots/s5_search_${name.replace(/\s+/g, '_')}.png` });

  // Look for it
  const card = page.locator(`text="${name}"`).first();
  const found = await card.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Credential "${name}" found:`, found);

  if (!found) {
    // Print all visible text that looks like credential names
    const allText = await page.locator('[class*="title"], [class*="name"], [class*="card"] h2, [class*="card"] h3, [class*="card"] span').allTextContents().catch(() => []);
    console.log('Visible text in cards:', JSON.stringify(allText.slice(0, 20)));
  }
  return found;
}

try {
  const loggedIn = await loginN8n();
  console.log('Logged in:', loggedIn);

  if (!loggedIn) {
    // Try to check the page content for error
    const bodyText = await page.locator('body').textContent().catch(() => '');
    console.log('Page body (first 500):', bodyText.slice(0, 500));
    throw new Error('Login failed');
  }

  await navigateToCredentials();

  // TODO-1: Find Gmail account 4
  const found = await findCredential('Gmail account 4');
  if (found) {
    console.log('Opening Gmail account 4...');
    await page.locator('text="Gmail account 4"').first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/screenshots/s6_gmail_open.png' });
    
    // Find modal/panel content
    const modal = page.locator('[role="dialog"], .modal, [class*="modal-body"]').first();
    const modalText = await modal.textContent().catch(() => '');
    console.log('Modal content:', modalText.slice(0, 400));
    
    // Check for reconnect button
    const btnTexts = ['Sign in with Google', 'Reconnect', 'Connect', 'Re-authorize', 'Sign In'];
    for (const btnText of btnTexts) {
      const btn = page.locator(`button:has-text("${btnText}"), a:has-text("${btnText}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Found button: "${btnText}"`);
      }
    }
    await page.screenshot({ path: 'tasks/screenshots/s7_modal.png' });
    
    // Check if the credential status shows errors
    const status = await page.locator('[class*="status"], [class*="error"], [class*="connection"]').allTextContents().catch(() => []);
    console.log('Status elements:', JSON.stringify(status));
  }

  console.log('\n=== TODO-1 STATUS: Need to check screenshots ===');
  console.log('Screenshots saved in tasks/screenshots/');

} catch(e) {
  console.error('FATAL:', e.message);
  await page.screenshot({ path: 'tasks/screenshots/fatal_error.png' }).catch(() => {});
} finally {
  await browser.close();
  console.log('Done');
}
