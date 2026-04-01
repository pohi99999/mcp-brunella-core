import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

console.log('=== n8n Automation Suite ===');

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// ─── Helper: Login to n8n ───────────────────────────────────────
async function loginN8n(emailToTry) {
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  
  await page.fill('input[type="email"]', emailToTry);
  await page.fill('input[type="password"]', 'iszapfalo13');
  
  await page.click('button[type="submit"], button:has-text("Sign in")');
  
  try {
    await page.waitForURL(url => !url.toString().includes('/signin'), { timeout: 12000 });
    console.log(`✅ Logged in with ${emailToTry} → URL: ${page.url()}`);
    return true;
  } catch {
    // Check for error messages
    const errText = await page.locator('[class*="error"], [class*="alert"], [role="alert"]').first().textContent().catch(() => '');
    console.log(`Login failed with ${emailToTry}. Error: ${errText}`);
    await page.screenshot({ path: `tasks/screenshots/login_failed_${emailToTry.replace('@','_at_').replace('.','_')}.png` });
    return false;
  }
}

// ─── Try login with different email combinations ─────────────────
let loggedIn = false;
const emailsToTry = [
  'iszapfalo@gmail.com',
  'iszapfalo@iszapfalo.hu',
  'info@iszapfalo.hu',
];

for (const email of emailsToTry) {
  loggedIn = await loginN8n(email);
  if (loggedIn) break;
  await page.waitForTimeout(1000);
}

if (!loggedIn) {
  console.log('❌ Could not login with any email combination');
  // Print full page text to help diagnose
  const bodyHTML = await page.content();
  console.log('Page content snippet:', bodyHTML.slice(0, 1000));
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: 'tasks/screenshots/logged_in_dashboard.png' });
console.log('Dashboard URL:', page.url());

// ─── TODO-1: Navigate to Credentials ────────────────────────────
console.log('\n=== TODO-1: Gmail OAuth2 ===');
await page.goto('https://iszapfalo.app.n8n.cloud/home/credentials', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'tasks/screenshots/t1_credentials_page.png' });
console.log('Credentials page URL:', page.url());

// Search for Gmail account 4
const searchBox = page.locator('input[placeholder*="search" i], input[type="search"]').first();
if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
  await searchBox.fill('Gmail account 4');
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'tasks/screenshots/t1_search_result.png' });

// List all visible credentials
const credItems = await page.locator('[class*="card"], [class*="list"] li, [class*="credential"]').allTextContents().catch(() => []);
console.log('Credential items visible:', credItems.slice(0, 10).join(' | '));

// Find Gmail account 4
const gmailCard = page.locator('text="Gmail account 4"').first();
const gmailFound = await gmailCard.isVisible({ timeout: 5000 }).catch(() => false);
console.log('Gmail account 4 found:', gmailFound);

if (gmailFound) {
  await gmailCard.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred_modal.png' });
  
  // Get modal text
  const modalText = await page.locator('[role="dialog"], [class*="modal"]').first().textContent().catch(() => '');
  console.log('Modal text:', modalText.slice(0, 500));
  
  // Check for auth buttons
  const authBtns = ['Sign in with Google', 'Reconnect', 'Re-authorize', 'Connect', 'Authorize'];
  for (const btnName of authBtns) {
    const btn = page.locator(`button:has-text("${btnName}"), a:has-text("${btnName}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`✅ Found button: "${btnName}"`);
    }
  }
} else {
  // Try clicking directly on any card with "Gmail" in the title  
  const allCards = page.locator('[class*="title"], h2, h3, [class*="name"]');
  const allTexts = await allCards.allTextContents().catch(() => []);
  console.log('All visible titles:', JSON.stringify(allTexts));
}

await browser.close();
console.log('=== Script complete ===');
