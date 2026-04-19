const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5678';
const SCREENSHOT_DIR = 'F:\\mcp-brunella-core';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Pre-obtained valid session cookie (from successful API login at 02:50:24Z)
// Valid for 7 days (exp: 2026-04-05)
const N8N_AUTH_COOKIE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU3OTNkYTg2LWM1NWItNDg2MS05ZTdhLTUyNjBkNDRmMjA3NyIsImhhc2giOiJuc2dwMnhtYkJiIiwidXNlZE1mYSI6ZmFsc2UsImlhdCI6MTc3NDc1MjYyNCwiZXhwIjoxNzc1MzU3NDI0fQ.lfW3CfePiUboP3TsyTSBtJPdl6keZ4Xn7Z6UOsAfoR0';

function ts() { return new Date().toISOString(); }
function log(msg) { console.log('[' + ts() + '] ' + msg); }

async function ss(page, name) {
  const p = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  log('Screenshot: ' + p);
  return p;
}

(async () => {
  let browser, page;
  try {
    log('=== N8N BROWSER AUTOMATION - COOKIE INJECTION MODE ===');
    log('Launching Chromium headless (1440x900, DPR=1, Chrome/124)...');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      userAgent: UA
    });
    page = await ctx.newPage();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Inject pre-obtained session cookie, skip login form
    // ─────────────────────────────────────────────────────────────
    log('Injecting pre-obtained n8n-auth session cookie...');
    await ctx.addCookies([{
      name: 'n8n-auth',
      value: N8N_AUTH_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);
    log('Cookie injected: n8n-auth=' + N8N_AUTH_COOKIE.substring(0,40) + '...');

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Navigate to n8n root - verify authenticated
    // ─────────────────────────────────────────────────────────────
    log('Navigating to ' + BASE_URL + '...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    log('After root nav - URL: ' + page.url());
    await ss(page, 'step1-initial.png');

    // Check if sign-in page or setup wizard appeared
    if (page.url().includes('signin') || page.url().includes('setup')) {
      log('WARNING: Redirected to ' + page.url() + ' - cookie may be invalid/expired');
      // Screenshot the signin page state
      await ss(page, 'step1-signin-redirect.png');
      throw new Error('Cookie injection failed - n8n redirected to ' + page.url() + '. Cookie may be expired or n8n restarted.');
    }
    log('Authentication confirmed - cookie accepted, not redirected to signin.');

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Navigate to Workflows list
    // ─────────────────────────────────────────────────────────────
    log('Navigating to workflows list: /home/workflows...');
    await page.goto(BASE_URL + '/home/workflows', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    log('Workflows URL: ' + page.url());

    // Wait for workflow list items to appear
    log('Waiting for workflow cards...');
    try {
      await page.waitForSelector(
        '[data-test-id="resources-list-item"], .workflow-card, [data-test-id="workflow-card-name"], [class*="WorkflowCard"]',
        { timeout: 15000 }
      );
      log('Workflow cards detected in DOM');
    } catch(e) {
      log('Workflow card selector timed out: ' + e.message);
      log('Continuing anyway...');
    }
    await page.waitForTimeout(1500);

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Save workflows-list.png screenshot
    // ─────────────────────────────────────────────────────────────
    await ss(page, 'workflows-list.png');
    log('workflows-list.png saved with all visible workflows in viewport');

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Extract workflow names and statuses
    // ─────────────────────────────────────────────────────────────
    log('Extracting workflow names and statuses...');
    const extracted = await page.evaluate(() => {
      const results = [];

      // Strategy 1: n8n resources-list-item (most reliable)
      const listItems = document.querySelectorAll('[data-test-id="resources-list-item"]');
      if (listItems.length > 0) {
        listItems.forEach((item, idx) => {
          const nameEl = item.querySelector('[data-test-id="workflow-card-name"]') ||
                         item.querySelector('[class*="workflow-card-name"]') ||
                         item.querySelector('[class*="name"]') ||
                         item.querySelector('span, h2, h3, a');
          const name = nameEl ? nameEl.innerText.trim() : ('Item ' + idx);

          // Check active status - look for toggle, badge, or text
          const toggleEl = item.querySelector('[data-test-id="workflow-card-activator"]');
          const activeBadge = item.querySelector('[class*="active-badge"], [class*="ActiveBadge"]');
          const statusText = item.innerText;
          const isActive = (toggleEl && toggleEl.getAttribute('aria-checked') === 'true') ||
                           (activeBadge && activeBadge.innerText.trim().toLowerCase() === 'active') ||
                           statusText.toLowerCase().includes('\nactive\n') ||
                           statusText.split('\n').some(l => l.trim() === 'Active');

          results.push({
            name,
            status: isActive ? 'Active' : 'Inactive',
            fullText: item.innerText.trim().substring(0, 200)
          });
        });
        return { method: 'resources-list-item', count: results.length, items: results };
      }

      // Strategy 2: Any workflow-related cards
      const cards = document.querySelectorAll('[class*="workflow"], [class*="Workflow"]');
      if (cards.length > 0) {
        cards.forEach(card => {
          const txt = card.innerText.trim();
          if (txt) results.push({ name: txt.split('\n')[0], status: 'Unknown', fullText: txt.substring(0,200) });
        });
        return { method: 'workflow-class', count: results.length, items: results };
      }

      // Strategy 3: Full body text for analysis
      return { method: 'body-text', count: 0, items: [], bodyText: document.body.innerText };
    });

    log('');
    log('=== WORKFLOW LIST EXTRACTION ===');
    log('Method: ' + extracted.method);
    log('Count: ' + extracted.count);
    log('');
    if (extracted.items.length > 0) {
      log('--- ALL VISIBLE WORKFLOWS ---');
      extracted.items.forEach((w, i) => {
        log('  ' + (i+1) + '. [' + w.status.toUpperCase() + '] "' + w.name + '"');
      });
      log('');

      // Identify bookkeeping workflows
      const bkKeywords = ['bookkeeping', 'accounting', 'invoice', 'ledger', 'finance', 'email intake', 'brunella'];
      const bkFlows = extracted.items.filter(w =>
        bkKeywords.some(kw => w.name.toLowerCase().includes(kw) || w.fullText.toLowerCase().includes(kw))
      );
      log('--- BOOKKEEPING-RELATED WORKFLOWS (' + bkFlows.length + ' found) ---');
      bkFlows.forEach(w => log('  * [' + w.status.toUpperCase() + '] "' + w.name + '"'));
    } else {
      log('Body text for manual analysis:');
      console.log(extracted.bodyText ? extracted.bodyText.substring(0, 4000) : '(empty)');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 6: Open "Brunella Bookkeeping Email Intake Scaffold"
    // ─────────────────────────────────────────────────────────────
    const TARGET = 'Brunella Bookkeeping Email Intake Scaffold';
    log('');
    log('Opening workflow: "' + TARGET + '"...');

    let clicked = false;

    // Try 1: exact text locator (Playwright)
    const exactLoc = page.locator('text="' + TARGET + '"').first();
    if (await exactLoc.count() > 0) {
      log('Strategy 1: Found by exact text. Scrolling and clicking...');
      await exactLoc.scrollIntoViewIfNeeded();
      await exactLoc.click();
      clicked = true;
    }

    if (!clicked) {
      // Try 2: list item containing target text
      const itemLoc = page.locator('[data-test-id="resources-list-item"]:has-text("Email Intake Scaffold")').first();
      if (await itemLoc.count() > 0) {
        log('Strategy 2: Found via list item partial match. Clicking...');
        await itemLoc.click();
        clicked = true;
      }
    }

    if (!clicked) {
      // Try 3: any element containing text
      const allEls = await page.$$('*');
      for (const el of allEls) {
        try {
          const tag = await el.evaluate(e => e.tagName);
          if (['SCRIPT', 'STYLE', 'HEAD', 'HTML', 'BODY'].includes(tag)) continue;
          const children = await el.evaluate(e => e.children.length);
          if (children > 5) continue; // skip containers
          const txt = await el.innerText();
          if (txt && txt.trim() === TARGET) {
            log('Strategy 3: Found by exact innerText match on <' + tag + '>. Clicking...');
            await el.click();
            clicked = true;
            break;
          }
        } catch(e) { /* skip */ }
      }
    }

    if (!clicked) {
      // Strategy 4: Navigate by workflow ID from database
      log('Strategy 4: Using database to find workflow ID...');
      // Get workflow ID from page URL pattern or try API
      const allLinks = await page.$$eval('a[href]', els => els.map(e => ({ href: e.href, text: e.innerText?.trim() })));
      log('All links on page: ' + JSON.stringify(allLinks.slice(0,20)));
      await ss(page, 'error-state-notfound-' + Date.now() + '.png');
      throw new Error('Workflow "' + TARGET + '" could not be found or clicked via any strategy');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 7: Wait for workflow editor canvas to render
    // ─────────────────────────────────────────────────────────────
    log('Waiting for navigation/loading after click...');
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(5000);
    log('Editor page URL: ' + page.url());
    await ss(page, 'step5-workflow-editor-loading.png');

    log('Waiting for editor canvas to render...');
    const canvasSelectors = [
      '.jtk-surface',
      'canvas',
      '[data-test-id="canvas"]',
      '[data-test-id="workflow-canvas"]',
      '[data-test-id="node-view"]',
      '[class*="Canvas"]',
      '[class*="canvas"]',
      '[class*="WorkflowEditor"]',
      '[class*="NodeView"]',
      '.workflow-canvas'
    ];

    let matchedCanvas = null;
    for (const sel of canvasSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 10000 });
        matchedCanvas = sel;
        log('Canvas confirmed with selector: "' + sel + '"');
        break;
      } catch(e) {
        // next
      }
    }

    await page.waitForTimeout(2000);
    await ss(page, 'step5-workflow-editor-final.png');

    const editorInfo = await page.evaluate(() => {
      const canvasEl = document.querySelector('canvas');
      const jtkSurface = document.querySelector('.jtk-surface');
      const nodeEls = document.querySelectorAll('[class*="node"], .jtk-node, [data-name], [data-type]');
      const nodeTexts = Array.from(nodeEls)
        .map(n => n.getAttribute('data-name') || n.querySelector('[class*="name"]')?.innerText || n.innerText || '')
        .map(t => t.trim())
        .filter(t => t && t.length > 1)
        .slice(0, 20);

      return {
        url: window.location.href,
        title: document.title,
        hasCanvas: !!canvasEl,
        hasJtkSurface: !!jtkSurface,
        canvasSize: canvasEl ? (canvasEl.width + 'x' + canvasEl.height) : 'N/A',
        nodeCount: nodeEls.length,
        nodeTexts: [...new Set(nodeTexts)],
        bodyPreview: document.body.innerText.replace(/\s+/g, ' ').substring(0, 400)
      };
    });

    log('');
    log('=======================================================');
    log('  WORKFLOW EDITOR CONFIRMATION');
    log('=======================================================');
    log('URL:            ' + editorInfo.url);
    log('Page Title:     ' + editorInfo.title);
    log('Canvas <canvas>:' + editorInfo.hasCanvas + (editorInfo.hasCanvas ? ' (size: ' + editorInfo.canvasSize + ')' : ''));
    log('JTK Surface:    ' + editorInfo.hasJtkSurface);
    log('Canvas selector:' + (matchedCanvas || 'none matched'));
    log('Node elements:  ' + editorInfo.nodeCount);
    log('Node names:     ' + JSON.stringify(editorInfo.nodeTexts));
    log('Body preview:   ' + editorInfo.bodyPreview);

    if (editorInfo.hasCanvas || editorInfo.hasJtkSurface || matchedCanvas) {
      log('');
      log('✅ SUCCESS: Workflow editor canvas/graph rendered. Editor is live.');
    } else {
      log('');
      log('⚠ WARNING: No canvas element detected in DOM. Editor may still be loading or using a different render method.');
    }

  } catch(err) {
    log('FATAL ERROR: ' + err.message);
    if (page) {
      const ep = path.join(SCREENSHOT_DIR, 'error-state-' + Date.now() + '.png');
      await page.screenshot({ path: ep });
      log('Error screenshot: ' + ep);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    log('Done. Browser closed.');
  }
})();
