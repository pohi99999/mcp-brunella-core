const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log('=== TODO-1: n8n Login ===');
  await page.goto('https://iszapfalo.app.n8n.cloud/signin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'tasks/step1_signin.png' });

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('iszapfalo');

  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill('iszapfalo13');

  await page.screenshot({ path: 'tasks/step1b_filled.png' });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/step2_after_login.png' });
  console.log('URL after login:', page.url());

  // Navigate to Credentials
  console.log('Navigating to credentials...');
  await page.goto('https://iszapfalo.app.n8n.cloud/home/credentials', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tasks/step3_credentials.png' });
  console.log('Credentials page URL:', page.url());

  // Search for Gmail account 4
  const searchInput = page.locator('input[placeholder*="search" i]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('Gmail account 4');
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'tasks/step4_search_gmail.png' });

  // Find Gmail account 4 in results
  const gmailCred = page.locator('text=Gmail account 4').first();
  const found = await gmailCred.isVisible({ timeout: 5000 }).catch(() => false);

  if (found) {
    console.log('Found Gmail account 4, clicking...');
    await gmailCred.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/step5_gmail_cred_open.png' });

    // Look for reconnect / re-auth button
    const reconnectBtn = page.locator('button:has-text("Sign in"), button:has-text("Reconnect"), button:has-text("Connect"), a:has-text("Sign in with Google")').first();
    const hasReconnect = await reconnectBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReconnect) {
      console.log('Reconnect button found, clicking...');
      // Open OAuth popup
      const [popup] = await Promise.all([
        ctx.waitForEvent('page'),
        reconnectBtn.click()
      ]);
      await popup.waitForTimeout(3000);
      await popup.screenshot({ path: 'tasks/step6_oauth_popup.png' });
      console.log('OAuth popup URL:', popup.url());

      // Check for "not secure browser" error
      const pageContent = await popup.content();
      if (pageContent.includes('not secure') || pageContent.includes('This browser') || pageContent.includes('app may not be secure')) {
        console.log('BLOCKED: Google showing "browser not secure" error - manual intervention needed');
        await popup.screenshot({ path: 'tasks/step6_blocked.png' });
      } else {
        // Try to login
        const emailField = popup.locator('input[type="email"]').first();
        if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
          await emailField.fill('iszapfalo@gmail.com');
          await popup.click('button:has-text("Next")');
          await popup.waitForTimeout(2000);
          await popup.screenshot({ path: 'tasks/step7_oauth_email.png' });

          const pwField = popup.locator('input[type="password"]').first();
          if (await pwField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await pwField.fill('IszapfaloAI25+');
            await popup.click('button:has-text("Next")');
            await popup.waitForTimeout(3000);
            await popup.screenshot({ path: 'tasks/step8_oauth_pw.png' });
          }
        }

        // Allow access
        const allowBtn = popup.locator('button:has-text("Allow"), button:has-text("Continue")').first();
        if (await allowBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await allowBtn.click();
          await popup.waitForTimeout(3000);
          await popup.screenshot({ path: 'tasks/step9_oauth_allow.png' });
        }
      }
    } else {
      console.log('No reconnect button visible - credential may already be connected or different UI');
      const panelText = await page.locator('.modal, [role="dialog"], .n8n-modal').first().textContent().catch(() => 'N/A');
      console.log('Panel text snippet:', panelText.slice(0, 200));
    }
  } else {
    console.log('Gmail account 4 NOT FOUND');
    // List available credentials
    const items = await page.locator('[class*="card"], [class*="list-item"], [class*="credential"]').allTextContents();
    console.log('Visible items:', JSON.stringify(items.slice(0, 15)));
  }

  await page.screenshot({ path: 'tasks/step_todo1_final.png' });
  await browser.close();
  console.log('=== TODO-1 COMPLETE ===');
})().catch(e => {
  console.error('FATAL ERROR:', e.message);
  process.exit(1);
});
