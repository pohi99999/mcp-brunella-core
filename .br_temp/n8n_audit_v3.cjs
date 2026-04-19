// n8n audit v3 - click-based workflow navigation
const { chromium } = require("playwright");

function ts() { return new Date().toISOString(); }

(async () => {
  console.log(`[${ts()}] START`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // === STEP 1: Load signin page ===
  console.log(`[${ts()}] STEP 1: Loading signin page`);
  const resp = await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  console.log(`[STEP1] HTTP Status: ${resp ? resp.status() : "unknown"}`);
  console.log(`[STEP1] Final URL: ${page.url()}`);
  console.log(`[STEP1] Title: ${await page.title()}`);
  console.log(`[STEP1] Page type: normal-signin-form`);

  // === STEP 2: Authenticate ===
  console.log(`[${ts()}] STEP 2: Authenticating`);
  await page.fill('input[name="emailOrLdapLoginId"]', "dev@localhost.com");
  await page.fill('input[name="password"]', "DevPass2026!");
  await page.click('button.button:has-text("Sign in")');
  
  // Wait for redirect from signin
  let authOk = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (!page.url().includes("/signin")) { authOk = true; break; }
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  console.log(`[STEP2] Auth OK: ${authOk} | URL: ${page.url()}`);

  // Try REST API with n8n-auth cookie
  const cookies = await context.cookies("http://localhost:5678");
  console.log(`[STEP2] Cookies: ${JSON.stringify(cookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) })))}`);
  
  // Try API with explicit cookies header
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  const apiResult = await page.evaluate(async (cookieHdr) => {
    // Try with credentials: include
    const r1 = await fetch("/rest/workflows?limit=100", { credentials: "include" });
    const d1 = await r1.json().catch(() => ({}));
    
    // Also try with explicit header
    const r2 = await fetch("/rest/workflows?limit=100", {
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookieHdr,
        "browser-id": document.cookie
      },
      credentials: "include"
    });
    const d2 = await r2.json().catch(() => ({}));
    
    return {
      r1Status: r1.status, d1,
      r2Status: r2.status, d2,
      docCookies: document.cookie.substring(0, 200)
    };
  }, cookieHeader);
  
  console.log(`[API] r1 status: ${apiResult.r1Status} | r2 status: ${apiResult.r2Status}`);
  console.log(`[API] docCookies: ${apiResult.docCookies}`);
  if (apiResult.d1.data) {
    console.log(`[API] Workflows from r1: ${JSON.stringify(apiResult.d1.data.map(w => ({ id: w.id, name: w.name, active: w.active, tags: w.tags })), null, 2)}`);
  }
  if (apiResult.d2.data) {
    console.log(`[API] Workflows from r2: ${JSON.stringify(apiResult.d2.data.map(w => ({ id: w.id, name: w.name, active: w.active })))}`);
  }

  // === STEP 3: Workflows list ===
  console.log(`[${ts()}] STEP 3: Navigating to workflows`);
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 4000));
  
  console.log(`[STEP3] URL: ${page.url()}`);
  console.log(`[STEP3] Title: ${await page.title()}`);

  // === STEP 4: Screenshot ===
  console.log(`[${ts()}] STEP 4: Screenshot`);
  const listBuf = await page.screenshot();
  const listB64 = listBuf.toString("base64");
  const CHUNK = 40000;
  const totalC = Math.ceil(listB64.length / CHUNK);
  console.log(`WFLIST_SS_LEN:${listB64.length} WFLIST_SS_CHUNKS:${totalC}`);
  for (let i = 0; i < totalC; i++) {
    process.stdout.write(`WFLIST_SS_CHUNK_${i}:${listB64.substring(i * CHUNK, (i + 1) * CHUNK)}\n`);
  }

  // === STEP 5: Get workflow links from DOM ===
  console.log(`[${ts()}] STEP 5: Extracting workflow links from DOM`);
  const workflowLinks = await page.evaluate(() => {
    // Find links to workflow editor pages
    const links = Array.from(document.querySelectorAll('a[href*="/workflow/"]'));
    const results = {};
    links.forEach(link => {
      const href = link.getAttribute("href");
      const match = href.match(/\/workflow\/([^/?]+)/);
      if (match) {
        const id = match[1];
        // Get nearest text for workflow name
        let name = "";
        // Try parent card
        const card = link.closest('[class*="card"], [class*="workflow"], li, tr');
        if (card) {
          name = card.innerText.trim().substring(0, 200);
        } else {
          name = link.innerText.trim() || link.closest("[class]")?.innerText?.trim() || "";
        }
        if (!results[id]) {
          results[id] = { id, href, name, active: null };
        }
      }
    });
    
    // Also check for data-test-id patterns
    const wfItems = document.querySelectorAll('[data-test-id="workflow-card"], [class*="workflow-card"]');
    wfItems.forEach(item => {
      const link = item.querySelector('a[href*="/workflow/"]');
      if (link) {
        const href = link.getAttribute("href");
        const match = href.match(/\/workflow\/([^/?]+)/);
        if (match) {
          const id = match[1];
          const toggle = item.querySelector('input[type="checkbox"], [class*="toggle"], [class*="switch"]');
          results[id] = {
            id,
            href,
            name: item.innerText.trim().substring(0, 200),
            active: toggle ? toggle.checked : null
          };
        }
      }
    });
    
    return Object.values(results);
  });
  
  console.log(`[STEP5] Found ${workflowLinks.length} workflow links`);
  for (const wf of workflowLinks) {
    console.log(`  WF_LINK: id=${wf.id} href=${wf.href} name="${wf.name.split("\n")[0]}" active=${wf.active}`);
  }

  // If no links found, try clicking directly
  if (workflowLinks.length === 0) {
    console.log(`[STEP5] No links found - checking full DOM for workflow names`);
    const domInfo = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll("a")).map(a => ({ href: a.href, text: a.innerText.trim().substring(0, 80) })).filter(a => a.href);
      const bodyText = document.body.innerText.substring(0, 3000);
      return { allLinks: allLinks.slice(0, 20), bodyText };
    });
    console.log(`[STEP5] All links: ${JSON.stringify(domInfo.allLinks)}`);
    console.log(`[STEP5] Body: ${domInfo.bodyText}`);
  }

  // === STEP 6: Target workflow status ===
  const targets = [
    "Brunella Bookkeeping Email Intake Scaffold",
    "Brunella Bookkeeping Reconciliation Scaffold",
    "Brunella Bookkeeping NAV Validation Scaffold",
    "Brunella Bookkeeping Exception Notify Scaffold"
  ];

  console.log(`[${ts()}] STEP 6: Target workflow status`);
  const targetData = {};
  for (const target of targets) {
    const wf = workflowLinks.find(w => w.name && w.name.includes(target));
    if (wf) {
      console.log(`[TARGET] FOUND: "${target}" | id=${wf.id} | active=${wf.active}`);
      targetData[target] = wf;
    } else {
      console.log(`[TARGET] NOT FOUND: "${target}"`);
      targetData[target] = null;
    }
  }

  // === STEP 7: Open each workflow ===
  console.log(`[${ts()}] STEP 7: Opening target workflows`);
  
  // If no links found via DOM, try clicking on workflow cards
  for (const target of targets) {
    let wf = targetData[target];
    
    if (!wf) {
      // Try clicking the workflow name in the list
      console.log(`[${ts()}] Trying to click "${target}" in list`);
      await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      
      // Try to find and click the workflow name
      const clicked = await page.evaluate(async (targetName) => {
        // Find element containing this text
        const elements = document.querySelectorAll('[class*="name"], [class*="title"], h3, h4, span, a, td');
        for (const el of elements) {
          if (el.innerText && el.innerText.trim() === targetName) {
            el.click();
            return { found: true, tag: el.tagName, text: el.innerText };
          }
        }
        return { found: false };
      }, target);
      
      if (clicked.found) {
        await new Promise(r => setTimeout(r, 3000));
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        const newUrl = page.url();
        if (newUrl.includes("/workflow/")) {
          const match = newUrl.match(/\/workflow\/([^/?]+)/);
          if (match) {
            wf = { id: match[1], href: newUrl, name: target };
            console.log(`[EDITOR] Navigated to: ${newUrl}`);
          }
        }
      }
    }
    
    if (!wf) {
      console.log(`[EDITOR] COULD NOT OPEN "${target}" - not found`);
      continue;
    }

    console.log(`[${ts()}] [EDITOR] Opening "${target}" id=${wf.id}`);
    await page.goto(`http://localhost:5678/workflow/${wf.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    const edUrl = page.url();
    const edTitle = await page.title();
    const edState = await page.evaluate(() => {
      // Various node selectors for n8n
      const selectors = [
        '[data-name="NodeItem"]',
        '[class*="nodeItem"]',
        '[class*="CanvasNode"]',
        '[class*="flowNode"]',
        '[class*="node-default"]',
        '.jtk-connected',
        '[class*="VueFlow"]',
        '[class*="vue-flow__node"]',
        '[class*="node "]',
        '[class*="-node"]'
      ];
      let nodeCount = 0;
      for (const sel of selectors) {
        const cnt = document.querySelectorAll(sel).length;
        if (cnt > nodeCount) nodeCount = cnt;
      }
      const errEl = document.querySelector('[class*="toast-error"], [class*="n8n-toast"][class*="error"], .el-notification.error');
      const spinnerEl = document.querySelector('[class*="el-loading-mask"]:not([style*="display: none"]), [class*="loading"][class*="show"]');
      const readonlyEl = document.querySelector('[class*="readOnly"], [class*="readonly"], [aria-readonly="true"]');
      return {
        nodeCount,
        errorToast: errEl ? errEl.innerText.trim().substring(0, 200) : null,
        spinnerVisible: !!spinnerEl,
        isReadOnly: !!readonlyEl,
        bodyText: document.body.innerText.substring(0, 1500),
        // Check canvas
        hasCanvas: !!(document.querySelector('[class*="canvas"], canvas, [class*="workflow-canvas"]'))
      };
    });

    console.log(`[EDITOR] "${target}":`);
    console.log(`  URL: ${edUrl}`);
    console.log(`  Title: ${edTitle}`);
    console.log(`  HasCanvas: ${edState.hasCanvas}`);
    console.log(`  NodeCount: ${edState.nodeCount}`);
    console.log(`  Error: ${edState.errorToast || "none"}`);
    console.log(`  Spinner: ${edState.spinnerVisible}`);
    console.log(`  ReadOnly: ${edState.isReadOnly}`);
    console.log(`  Body(600): ${edState.bodyText.substring(0, 600)}`);

    const edBuf = await page.screenshot();
    const edB64 = edBuf.toString("base64");
    const safeName = target.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    const ec = Math.ceil(edB64.length / CHUNK);
    console.log(`EDITOR_SS_${safeName}_LEN:${edB64.length} CHUNKS:${ec}`);
    for (let i = 0; i < ec; i++) {
      process.stdout.write(`EDITOR_SS_${safeName}_CHUNK_${i}:${edB64.substring(i * CHUNK, (i + 1) * CHUNK)}\n`);
    }

    await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[${ts()}] ALL STEPS COMPLETE`);
  await browser.close();
})().catch(e => { console.error(`FATAL: ${e.message}\n${e.stack}`); process.exit(1); });
