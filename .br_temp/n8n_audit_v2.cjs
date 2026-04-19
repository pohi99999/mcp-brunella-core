// n8n full audit script v2
const { chromium } = require("playwright");

function ts() { return new Date().toISOString(); }

(async () => {
  console.log(`[${ts()}] START - Fresh headless Chromium, no profile`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // === STEP 1: Load signin page ===
  console.log(`[${ts()}] STEP 1: GET http://localhost:5678/signin`);
  const resp = await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const s1url = page.url();
  const s1title = await page.title();
  const s1status = resp ? resp.status() : "unknown";
  const s1inputs = await page.$$eval("input", els => els.map(e => ({ type: e.type, name: e.name, id: e.id, placeholder: e.placeholder })));
  const s1buttons = await page.$$eval("button", els => els.slice(0, 5).map(e => ({ type: e.type, text: e.innerText.trim().substring(0, 40) })));
  const s1body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  
  console.log(`[STEP1] HTTP Status: ${s1status}`);
  console.log(`[STEP1] Final URL: ${s1url}`);
  console.log(`[STEP1] Title: ${s1title}`);
  console.log(`[STEP1] Inputs: ${JSON.stringify(s1inputs)}`);
  console.log(`[STEP1] Buttons: ${JSON.stringify(s1buttons)}`);
  console.log(`[STEP1] Body: ${s1body}`);
  console.log(`[STEP1] Page type: normal-signin-form (email+password fields, Sign in button)`);

  // === STEP 2: Authenticate ===
  console.log(`[${ts()}] STEP 2: Signing in email=dev@localhost.com password=DevPass2026!`);
  await page.fill('input[name="emailOrLdapLoginId"]', "dev@localhost.com");
  await page.fill('input[name="password"]', "DevPass2026!");
  
  // Click Sign in button (type=button, text="Sign in")
  await page.click('button.button:has-text("Sign in")');
  
  // Wait up to 15s for URL to change
  let authOk = false;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (!page.url().includes("/signin")) { authOk = true; break; }
  }
  
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  
  const s2url = page.url();
  const s2title = await page.title();
  const s2body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log(`[STEP2] Auth success: ${authOk}`);
  console.log(`[STEP2] URL after auth: ${s2url}`);
  console.log(`[STEP2] Title: ${s2title}`);
  console.log(`[STEP2] Body: ${s2body}`);

  if (!authOk && s2url.includes("/signin")) {
    const errEl = await page.$('[class*="error"], [role="alert"]');
    const errText = errEl ? await errEl.innerText() : "no error found";
    console.log(`[STEP2] AUTH FAILED. Error: ${errText}`);
    await browser.close();
    return;
  }

  // === STEP 3: Navigate to workflows list ===
  console.log(`[${ts()}] STEP 3: Navigating to workflows list`);
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const s3url = page.url();
  const s3title = await page.title();
  const s3body = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(`[STEP3] Workflows URL: ${s3url}`);
  console.log(`[STEP3] Workflows Title: ${s3title}`);
  console.log(`[STEP3] Body: ${s3body}`);

  // === STEP 4: Screenshot workflows list ===
  console.log(`[${ts()}] STEP 4: Screenshot of workflows list`);
  const listSSBuf = await page.screenshot();
  const listSS = listSSBuf.toString("base64");
  console.log(`[STEP4] Screenshot size (base64 chars): ${listSS.length}`);
  // Output in 40000-char chunks with markers
  const CHUNK = 40000;
  const totalC = Math.ceil(listSS.length / CHUNK);
  console.log(`WFLIST_SS_CHUNKS:${totalC}`);
  for (let i = 0; i < totalC; i++) {
    process.stdout.write(`WFLIST_SS_CHUNK_${i}:${listSS.substring(i * CHUNK, (i + 1) * CHUNK)}\n`);
  }

  // === STEP 5 & 6: Get API data ===
  console.log(`[${ts()}] STEP 5: Fetching workflow list from API`);
  const apiData = await page.evaluate(async () => {
    const r = await fetch("/rest/workflows?limit=200", { credentials: "include" });
    const d = await r.json();
    return { status: r.status, data: d };
  });
  console.log(`[STEP5] API HTTP status: ${apiData.status}`);

  let allWorkflows = [];
  if (apiData.data && Array.isArray(apiData.data.data)) {
    allWorkflows = apiData.data.data;
  } else if (Array.isArray(apiData.data)) {
    allWorkflows = apiData.data;
  }

  console.log(`[STEP5] Total workflows: ${allWorkflows.length}`);
  for (const w of allWorkflows) {
    const tags = w.tags ? w.tags.map(t => t.name || t).join(", ") : "";
    console.log(`  WF | id=${w.id} | name="${w.name}" | active=${w.active} | tags=[${tags}]`);
  }

  const targets = [
    "Brunella Bookkeeping Email Intake Scaffold",
    "Brunella Bookkeeping Reconciliation Scaffold",
    "Brunella Bookkeeping NAV Validation Scaffold",
    "Brunella Bookkeeping Exception Notify Scaffold"
  ];

  console.log(`[${ts()}] STEP 6: Target workflow status`);
  for (const target of targets) {
    const wf = allWorkflows.find(w => w.name && w.name.trim() === target.trim());
    if (wf) {
      const tags = wf.tags ? wf.tags.map(t => t.name || t).join(", ") : "none";
      console.log(`[TARGET] FOUND: "${target}" | id=${wf.id} | active=${wf.active} | tags=[${tags}]`);
    } else {
      console.log(`[TARGET] MISSING: "${target}"`);
    }
  }

  // === STEP 7: Open each target workflow ===
  console.log(`[${ts()}] STEP 7: Opening each target workflow canvas`);
  for (const target of targets) {
    const wf = allWorkflows.find(w => w.name && w.name.trim() === target.trim());
    if (!wf) {
      console.log(`[${ts()}] [EDITOR] SKIP "${target}" - not in API`);
      continue;
    }

    console.log(`[${ts()}] [EDITOR] Opening "${target}" (id=${wf.id})`);
    await page.goto(`http://localhost:5678/workflow/${wf.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    const edUrl = page.url();
    const edTitle = await page.title();
    const edState = await page.evaluate(() => {
      // Node selectors for n8n canvas
      const nodeSelectors = [
        '[data-name="NodeItem"]',
        '[class*="nodeItem"]',
        '[class*="CanvasNode"]',
        '[class*="node-default"]',
        '.jtk-connected',
        '[class*="flowNode"]'
      ];
      let nodeCount = 0;
      for (const sel of nodeSelectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > nodeCount) nodeCount = els.length;
      }
      const errEl = document.querySelector('[class*="toast-error"], [class*="n8n-toast"], .el-notification.error');
      const spinnerEl = document.querySelector('[class*="el-loading-mask"]:not([style*="display: none"])');
      const readonlyEl = document.querySelector('[class*="readonly"]');
      const unsavedEl = document.querySelector('[class*="unsaved"], [class*="dirty"], [class*="hasChanges"]');
      return {
        nodeCount,
        errorToast: errEl ? errEl.innerText.trim().substring(0, 200) : null,
        spinnerVisible: !!spinnerEl,
        isReadOnly: !!readonlyEl,
        hasUnsaved: !!unsavedEl,
        bodyText: document.body.innerText.substring(0, 1500)
      };
    });

    console.log(`[EDITOR] "${target}":`);
    console.log(`  URL: ${edUrl}`);
    console.log(`  Title: ${edTitle}`);
    console.log(`  NodeCount: ${edState.nodeCount}`);
    console.log(`  Error: ${edState.errorToast || "none"}`);
    console.log(`  Spinner: ${edState.spinnerVisible}`);
    console.log(`  ReadOnly: ${edState.isReadOnly}`);
    console.log(`  Unsaved: ${edState.hasUnsaved}`);
    console.log(`  Body: ${edState.bodyText.substring(0, 600)}`);

    const edSSBuf = await page.screenshot();
    const edSS = edSSBuf.toString("base64");
    const safeName = target.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    const ec = Math.ceil(edSS.length / CHUNK);
    console.log(`EDITOR_SS_${safeName}_CHUNKS:${ec}`);
    for (let i = 0; i < ec; i++) {
      process.stdout.write(`EDITOR_SS_${safeName}_CHUNK_${i}:${edSS.substring(i * CHUNK, (i + 1) * CHUNK)}\n`);
    }

    // Return to list
    await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[${ts()}] ALL STEPS COMPLETE`);
  await browser.close();
})().catch(e => { console.error(`FATAL: ${e.message}\n${e.stack}`); process.exit(1); });
