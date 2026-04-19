const { chromium } = require('playwright');
const path = require('path');
const http = require('http');

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

function loginViaAPI() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD });
    const options = {
      hostname: 'localhost', port: 5678, path: '/rest/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Accept': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, cookies: res.headers['set-cookie'] || [], body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  let browser, page;
  try {
    // STEP 1: API login
    log('API login attempt: ' + EMAIL);
    const login = await loginViaAPI();
    log('Login status: ' + login.status);
    log('Login body: ' + login.body.substring(0, 300));

    if (login.status === 429) throw new Error('RATE_LIMITED_429: Wait 5 minutes then retry.');
    if (login.status !== 200) throw new Error('Login failed: HTTP ' + login.status + ' - ' + login.body);

    log('Login SUCCESS. Cookies: ' + login.cookies.length);
    login.cookies.forEach(c => log('  Cookie raw: ' + c.substring(0, 100)));

    // STEP 2: Launch browser
    log('Launching Chromium headless 1440x900 Chrome/124...');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: UA });
    page = await ctx.newPage();

    // Parse and inject cookies
    const parsedCookies = login.cookies.map(cs => {
      const parts = cs.split(';').map(p => p.trim());
      const [nv] = parts;
      const eq = nv.indexOf('=');
      const name = nv.substring(0, eq);
      const value = nv.substring(eq + 1);
      const cookie = { name, value, domain: 'localhost', path: '/', sameSite: 'Lax' };
      return cookie;
    });
    log('Injecting ' + parsedCookies.length + ' cookies: ' + parsedCookies.map(c => c.name).join(', '));
    await ctx.addCookies(parsedCookies);

    // STEP 3: Navigate to workflows
    log('Navigating to /home/workflows...');
    await page.goto(BASE_URL + '/home/workflows', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    log('Current URL: ' + page.url());
    await saveScreenshot(page, 'step3-after-login.png');

    if (page.url().includes('signin')) {
      throw new Error('Cookie injection failed - redirected to signin. Rate limit or invalid cookie.');
    }

    // STEP 4: Wait for workflow list
    log('Waiting for workflow list to render...');
    try {
      await page.waitForSelector('[data-test-id="resources-list-item"], .workflow-card, [data-test-id="workflow-card-name"]', { timeout: 12000 });
      log('Workflow list items found');
    } catch(e) {
      log('Workflow list selector not found: ' + e.message);
    }
    await page.waitForTimeout(1000);

    // STEP 5: Screenshot + extract workflows
    await saveScreenshot(page, 'workflows-list.png');
    log('workflows-list.png saved');

    const extracted = await page.evaluate(() => {
      const r = [];
      // Try n8n data-test-id pattern
      const items = document.querySelectorAll('[data-test-id="resources-list-item"]');
      if (items.length > 0) {
        items.forEach(item => {
          const nameEl = item.querySelector('[data-test-id="workflow-card-name"]') ||
                         item.querySelector('[class*="workflow-card-name"]') ||
                         item.querySelector('h2, h3');
          const toggleEl = item.querySelector('[data-test-id="workflow-card-activator"]');
          const isActive = toggleEl ? toggleEl.getAttribute('aria-checked') === 'true' || toggleEl.classList.contains('active') : false;
          const fullTxt = item.innerText.trim();
          const name = nameEl ? nameEl.innerText.trim() : fullTxt.split('\n')[0].trim();
          r.push({ name, isActive, fullText: fullTxt.substring(0, 150) });
        });
        return { method: 'data-test-id', items: r };
      }
      // Fallback: body text
      return { method: 'body-fallback', items: [], bodyText: document.body.innerText.substring(0, 4000) };
    });

    log('Extraction: method=' + extracted.method + ', count=' + extracted.items.length);
    log('');
    log('=== ALL VISIBLE WORKFLOWS ===');
    extracted.items.forEach((w, i) => {
      log('  [' + (i+1) + '] [' + (w.isActive ? 'ACTIVE' : 'INACTIVE') + '] ' + w.name);
    });
    if (extracted.bodyText) {
      log('Body text fallback:');
      console.log(extracted.bodyText);
    }

    // STEP 6: Click target workflow
    const TARGET = 'Brunella Bookkeeping Email Intake Scaffold';
    log('');
    log('Clicking workflow: "' + TARGET + '"');

    let clicked = false;
    // Try exact text locator
    const loc = page.locator('text="' + TARGET + '"').first();
    if (await loc.count() > 0) {
      await loc.scrollIntoViewIfNeeded();
      await loc.click();
      clicked = true;
      log('Clicked via exact text locator');
    }

    if (!clicked) {
      // Try partial match in list items
      const items2 = await page.$$('[data-test-id="resources-list-item"], tr, li, a, [role="row"]');
      for (const el of items2) {
        try {
          const txt = await el.innerText();
          if (txt && txt.includes(TARGET)) {
            log('Found via exhaustive search, clicking: ' + txt.substring(0,80));
            await el.click();
            clicked = true;
            break;
          }
        } catch(e) { /* skip */ }
      }
    }

    if (!clicked) {
      await saveScreenshot(page, 'error-state-notfound-' + Date.now() + '.png');
      throw new Error('Workflow "' + TARGET + '" not found on page');
    }

    // STEP 7: Wait for editor
    log('Waiting for navigation after click...');
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(5000);
    log('Editor URL: ' + page.url());
    await saveScreenshot(page, 'step5-workflow-editor-loading.png');

    // Wait for canvas
    const canvasSelectors = ['.jtk-surface', 'canvas', '[data-test-id="canvas"]', '[data-test-id="workflow-canvas"]', '[class*="Canvas"]', '[class*="canvas"]', '[class*="Node"]', '.workflow-canvas'];
    let canvasFound = null;
    for (const sel of canvasSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        canvasFound = sel;
        log('Canvas detected with selector: ' + sel);
        break;
      } catch(e) { /* try next */ }
    }

    await saveScreenshot(page, 'step5-workflow-editor-final.png');

    const editorInfo = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      hasCanvas: !!(document.querySelector('canvas') || document.querySelector('.jtk-surface') || document.querySelector('[class*="Canvas"]')),
      nodeCount: document.querySelectorAll('[class*="node"], .jtk-node, [data-name]').length,
      bodyPreview: document.body.innerText.substring(0, 500)
    }));

    log('');
    log('=== WORKFLOW EDITOR CONFIRMATION ===');
    log('URL: ' + editorInfo.url);
    log('Title: ' + editorInfo.title);
    log('Canvas selector matched: ' + (canvasFound || 'none'));
    log('Canvas in DOM: ' + editorInfo.hasCanvas);
    log('Node elements count: ' + editorInfo.nodeCount);
    log('Page text preview: ' + editorInfo.bodyPreview.replace(/\n/g, ' | '));

    if (editorInfo.hasCanvas || canvasFound) {
      log('SUCCESS: Workflow editor canvas is rendered and confirmed.');
    } else {
      log('WARNING: No canvas element detected. Editor may still be loading.');
    }

  } catch (err) {
    log('FATAL: ' + err.message);
    if (page) {
      const ep = path.join(SCREENSHOT_DIR, 'error-state-' + Date.now() + '.png');
      await page.screenshot({ path: ep });
      log('Error screenshot: ' + ep);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    log('Browser closed. Done.');
  }
})();
