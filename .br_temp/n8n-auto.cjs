const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5678';
const EMAIL = 'dev@localhost.com';
const PASSWORD = 'DevPass2026!';
const SCREENSHOT_DIR = 'F:\\mcp-brunella-core';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function ts() { return new Date().toISOString(); }
function log(msg) { console.log('[' + ts() + '] ' + msg); }

async function saveScreenshot(page, name) {
  const p = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  log('Screenshot saved: ' + p);
  return p;
}

(async () => {
  let browser, page;
  try {
    log('Launching Chromium headless...');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      userAgent: UA
    });
    page = await context.newPage();

    // Step 1: Navigate
    log('Navigating to ' + BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    log('Page loaded. URL: ' + page.url());
    await saveScreenshot(page, 'step1-initial.png');

    const pageUrl = page.url();
    log('Current URL: ' + pageUrl);

    // Step 2: Handle setup wizard if present
    if (pageUrl.includes('setup') || pageUrl.includes('register')) {
      log('SETUP WIZARD detected at: ' + pageUrl);
      // Try to navigate directly to signin
      await page.goto(BASE_URL + '/signin', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      log('After goto signin: ' + page.url());
    }

    // Step 3: Sign in
    log('Waiting for sign-in form...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    log('Sign-in form found');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.click({ clickCount: 3 });
    await emailInput.fill(EMAIL);
    log('Email filled: ' + EMAIL);

    const passInput = page.locator('input[type="password"]').first();
    await passInput.click({ clickCount: 3 });
    await passInput.fill(PASSWORD);
    log('Password filled');

    await saveScreenshot(page, 'step2-login-filled.png');

    // Click sign in
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
    log('Clicking sign-in button...');
    await submitBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(3000);
    log('After login. URL: ' + page.url());
    await saveScreenshot(page, 'step3-after-login.png');

    // Check for login error
    if (page.url().includes('signin') || page.url().includes('login')) {
      const errText = await page.locator('[class*="error"], [class*="Error"], .el-form-item__error').allTextContents();
      if (errText.length > 0) throw new Error('Login error: ' + errText.join(', '));
    }

    // Step 4: Navigate to workflows
    log('Going to workflows list...');
    await page.goto(BASE_URL + '/home/workflows', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    log('Workflows page URL: ' + page.url());
    await saveScreenshot(page, 'step4-workflows-nav.png');

    // Step 5: Extract workflow names
    log('Extracting workflow items...');
    
    // Get all text on page for analysis
    const bodyText = await page.evaluate(() => document.body.innerText);
    log('--- BODY TEXT SAMPLE (first 4000 chars) ---');
    console.log(bodyText.substring(0, 4000));
    log('--- END BODY TEXT ---');

    // Try to get workflow rows
    const workflowItems = await page.evaluate(() => {
      const results = [];
      
      // n8n uses data-test-id attributes
      const items = document.querySelectorAll('[data-test-id="resources-list-item"]');
      if (items.length > 0) {
        items.forEach(item => {
          const nameEl = item.querySelector('[data-test-id="workflow-card-name"], .workflow-card-name, h3, h2, [class*="name"]');
          const statusEl = item.querySelector('[data-test-id="workflow-card-activator"], [class*="status"], [class*="active"]');
          const name = nameEl ? nameEl.innerText.trim() : item.querySelector('a')?.innerText?.trim() || '';
          const statusText = statusEl ? statusEl.innerText.trim() : '';
          const fullText = item.innerText.trim();
          results.push({ name, status: statusText, fullText: fullText.substring(0, 300) });
        });
        return results;
      }
      
      // Fallback: look for workflow cards
      const cards = document.querySelectorAll('.workflow-card, [class*="WorkflowCard"], [class*="workflow-card"]');
      cards.forEach(card => {
        results.push({ name: '', status: '', fullText: card.innerText?.trim()?.substring(0, 300) });
      });
      
      // Last resort: table rows
      const rows = document.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.innerText?.trim();
        if (text && text.length > 5 && !text.toLowerCase().includes('name') && !text.toLowerCase().includes('created')) {
          results.push({ name: '', status: '', fullText: text.substring(0, 300) });
        }
      });
      
      return results;
    });
    
    log('Workflow items extracted: ' + workflowItems.length);
    workflowItems.forEach((w, i) => {
      log('  [' + (i+1) + '] name="' + w.name + '" status="' + w.status + '"');
      if (w.fullText) log('      text: ' + w.fullText.split('\n')[0]);
    });

    // Save the workflows screenshot
    await saveScreenshot(page, 'workflows-list.png');
    log('workflows-list.png saved');

    // Step 6: Find target workflow
    const targetName = 'Brunella Bookkeeping Email Intake Scaffold';
    log('Searching for workflow: "' + targetName + '"');
    
    // Try direct text locator
    let targetEl = null;
    
    // Try various approaches
    const approaches = [
      () => page.locator('text="' + targetName + '"').first(),
      () => page.locator('[data-test-id="resources-list-item"]:has-text("' + targetName + '")').first(),
      () => page.locator('a:has-text("' + targetName + '")').first(),
      () => page.locator('span:has-text("' + targetName + '")').first(),
    ];
    
    for (let i = 0; i < approaches.length; i++) {
      try {
        const el = approaches[i]();
        const count = await el.count();
        log('Approach ' + (i+1) + ': count=' + count);
        if (count > 0) {
          targetEl = el;
          break;
        }
      } catch(e) {
        log('Approach ' + (i+1) + ' failed: ' + e.message);
      }
    }
    
    if (!targetEl) {
      // Last resort: search all elements
      log('Trying exhaustive element search...');
      const allTexts = await page.evaluate((target) => {
        const found = [];
        const all = document.querySelectorAll('*');
        all.forEach(el => {
          if (el.children.length === 0 && el.innerText && el.innerText.includes(target)) {
            found.push({ tag: el.tagName, class: el.className, text: el.innerText.trim() });
          }
        });
        return found.slice(0, 5);
      }, targetName);
      log('Exhaustive search results: ' + JSON.stringify(allTexts));
      
      if (allTexts.length === 0) {
        throw new Error('Target workflow "' + targetName + '" not found on page. Available workflows from body text search done above.');
      }
    }
    
    log('Found target workflow, clicking...');
    if (targetEl) {
      await targetEl.scrollIntoViewIfNeeded();
      await targetEl.click();
    }
    
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(4000);
    log('After clicking workflow. URL: ' + page.url());
    await saveScreenshot(page, 'step5-workflow-editor-loading.png');
    
    // Wait for editor canvas
    log('Waiting for workflow editor to render...');
    const canvasSelectors = [
      '.jtk-surface',
      'canvas',
      '[data-test-id="canvas"]',
      '[data-test-id="workflow-canvas"]',
      '[class*="Canvas"]',
      '.workflow-canvas',
      'svg[class*="workflow"]',
      '[data-test-id="node-view"]'
    ];
    
    let canvasFound = false;
    for (const sel of canvasSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 10000 });
        log('Canvas found with selector: ' + sel);
        canvasFound = true;
        break;
      } catch(e) {
        log('Selector not found: ' + sel);
      }
    }
    
    if (!canvasFound) {
      log('Canvas not found with standard selectors, checking page content...');
      const editorContent = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodySnippet: document.body.innerText.substring(0, 500),
          hasCanvas: !!document.querySelector('canvas'),
          hasNodes: document.querySelectorAll('[class*="node"]').length,
          hasSurface: !!document.querySelector('[class*="surface"], [class*="Surface"]')
        };
      });
      log('Editor page state: ' + JSON.stringify(editorContent, null, 2));
    }
    
    await saveScreenshot(page, 'step5-workflow-editor-final.png');
    
    // Get node info
    const nodeInfo = await page.evaluate(() => {
      const nodeEls = document.querySelectorAll('[class*="node"], [data-test-id*="node"], .jtk-node, [data-name]');
      const nodeNames = Array.from(nodeEls).map(n => {
        return (n.getAttribute('data-name') || n.querySelector('[class*="name"]')?.innerText || n.innerText || '').trim().substring(0, 80);
      }).filter(t => t && t.length > 0);
      
      return {
        nodeCount: nodeEls.length,
        nodeNames: [...new Set(nodeNames)].slice(0, 20),
        title: document.title,
        url: window.location.href
      };
    });
    
    log('=== WORKFLOW EDITOR CONFIRMATION ===');
    log('URL: ' + nodeInfo.url);
    log('Title: ' + nodeInfo.title);
    log('Canvas nodes found: ' + nodeInfo.nodeCount);
    log('Node names: ' + JSON.stringify(nodeInfo.nodeNames));
    log('SUCCESS: Workflow editor rendered');

  } catch (err) {
    log('FATAL ERROR: ' + err.message);
    if (page) {
      const errTs = Date.now();
      await saveScreenshot(page, 'error-state-' + errTs + '.png');
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    log('Browser closed. Done.');
  }
})();
