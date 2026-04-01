import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

console.log('=== TODO-1: n8n Gmail OAuth Renewal ===');
const browser = await chromium.launch({ headless: false, slowMo: 400 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

try {
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'tasks/screenshots/step1_signin.png' });
  console.log('Login page loaded');

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('iszapfalo');

  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill('iszapfalo13');
  await page.screenshot({ path: 'tasks/screenshots/step1b_filled.png' });

  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/screenshots/step2_after_login.png' });
  console.log('URL after login:', page.url());

  // Navigate to Credentials
  console.log('Navigating to credentials page...');
  await page.goto('https://iszapfalo.app.n8n.cloud/home/credentials', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tasks/screenshots/step3_credentials.png' });
  console.log('Credentials page URL:', page.url());

  // Search for Gmail account 4
  const searchInput = page.locator('input[placeholder*="search" i]').first();
  const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasSearch) {
    await searchInput.fill('Gmail account 4');
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'tasks/screenshots/step4_search_gmail.png' });

  // Find Gmail account 4
  const gmailCred = page.locator('text=Gmail account 4').first();
  const found = await gmailCred.isVisible({ timeout: 5000 }).catch(() => false);

  if (found) {
    console.log('Found "Gmail account 4", clicking...');
    await gmailCred.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/screenshots/step5_gmail_cred_open.png' });

    // Look for reconnect button
    const reconnectBtn = page.locator([
      'button:has-text("Sign in with Google")',
      'button:has-text("Reconnect")',
      'button:has-text("Connect")',
      'a:has-text("Sign in with Google")'
    ].join(', ')).first();

    const hasReconnect = await reconnectBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReconnect) {
      console.log('Reconnect button visible, attempting OAuth...');
      const [popup] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 10000 }),
        reconnectBtn.click()
      ]);
      await popup.waitForTimeout(3000);
      await popup.screenshot({ path: 'tasks/screenshots/step6_oauth_popup.png' });
      const popupUrl = popup.url();
      console.log('OAuth popup URL:', popupUrl);

      const pageContent = await popup.content();
      if (pageContent.includes('not secure') || pageContent.includes('This browser') || pageContent.includes('app may not be secure') || pageContent.includes('disallowed_useragent')) {
        console.log('BLOCKED: Google "browser not secure" / disallowed_useragent error');
        console.log('=> TODO-1 needs MANUAL INTERVENTION');
      } else {
        // Try email
        const emailField = popup.locator('input[type="email"]').first();
        if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
          await emailField.fill('iszapfalo@gmail.com');
          await popup.keyboard.press('Enter');
          await popup.waitForTimeout(2000);
          await popup.screenshot({ path: 'tasks/screenshots/step7_email_entered.png' });

          const pwField = popup.locator('input[type="password"]').first();
          if (await pwField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await pwField.fill('IszapfaloAI25+');
            await popup.keyboard.press('Enter');
            await popup.waitForTimeout(3000);
            await popup.screenshot({ path: 'tasks/screenshots/step8_pw_entered.png' });
          }
        }

        // Allow access
        const allowBtn = popup.locator('button:has-text("Allow"), button:has-text("Continue"), [id="submit_approve_access"]').first();
        if (await allowBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
          await allowBtn.click();
          await popup.waitForTimeout(3000);
          await popup.screenshot({ path: 'tasks/screenshots/step9_allowed.png' });
          console.log('Access allowed');
        }

        // Save in n8n
        await page.waitForTimeout(2000);
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Close")').first();
        if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
        await page.screenshot({ path: 'tasks/screenshots/step10_saved.png' });
        console.log('TODO-1: OAuth reconnect attempted');
      }
    } else {
      console.log('No reconnect button found - checking modal content...');
      const modalText = await page.locator('[role="dialog"], .modal, [class*="modal"]').first().textContent().catch(() => 'N/A');
      console.log('Modal text:', modalText.slice(0, 300));
      await page.screenshot({ path: 'tasks/screenshots/step5b_no_reconnect.png' });
    }
  } else {
    console.log('Gmail account 4 NOT FOUND in credentials list');
    const items = await page.locator('[class*="card-title"], [class*="credential-name"], h2, h3').allTextContents().catch(() => []);
    console.log('Visible credential names:', JSON.stringify(items.slice(0, 20)));
    await page.screenshot({ path: 'tasks/screenshots/step4_not_found.png' });
  }

} catch(e) {
  console.error('ERROR in TODO-1:', e.message);
  await page.screenshot({ path: 'tasks/screenshots/error_todo1.png' });
} finally {
  await browser.close();
  console.log('=== TODO-1 Script finished ===');
}
