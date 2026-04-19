// n8n audit script - headless Playwright automation
const { chromium } = require("playwright");

function ts() {
  return new Date().toISOString();
}

(async () => {
  console.log(`[${ts()}] STEP 1: Launching fresh headless Chromium (no profile/cookies)`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // ─── STEP 1: Initial page load ───────────────────────────────────────────────
  console.log(`[${ts()}] STEP 1: Navigating to http://localhost:5678/signin`);
  let resp;
  try {
    resp = await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  } catch (e) {
    console.log(`[${ts()}] ERROR navigating: ${e.message}`);
    await browser.close();
    return;
  }

  const initialUrl = page.url();
  const initialTitle = await page.title();
  const httpStatus = resp ? resp.status() : "unknown";
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  const inputs = await page.$$eval("input", els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, id: e.id })));
  const h1 = await page.$eval("h1", e => e.innerText).catch(() => "none");
  const h2 = await page.$eval("h2", e => e.innerText).catch(() => "none");
  const buttons = await page.$$eval("button", els => els.map(e => e.innerText.trim()).filter(t => t));

  console.log(`[${ts()}] --- INITIAL PAGE STATE ---`);
  console.log(`HTTP Status: ${httpStatus}`);
  console.log(`Final URL: ${initialUrl}`);
  console.log(`Page Title: ${initialTitle}`);
  console.log(`H1: ${h1}`);
  console.log(`H2: ${h2}`);
  console.log(`Inputs: ${JSON.stringify(inputs)}`);
  console.log(`Buttons: ${JSON.stringify(buttons)}`);
  console.log(`Body text (first 1000): ${bodyText.substring(0, 1000)}`);

  // Determine page type
  let pageType = "unknown";
  if (initialUrl.includes("/setup") || bodyText.toLowerCase().includes("owner") || bodyText.toLowerCase().includes("first name")) {
    pageType = "first-run-setup-wizard";
  } else if (inputs.some(i => i.type === "email" || i.name === "emailOrLdapLoginId") && inputs.some(i => i.type === "password")) {
    pageType = "normal-signin-form";
  } else if (httpStatus === 401) {
    pageType = "http-basic-auth-401";
  }
  console.log(`[${ts()}] Page type detected: ${pageType}`);

  // ─── STEP 2: Authentication ──────────────────────────────────────────────────
  if (pageType === "normal-signin-form") {
    console.log(`[${ts()}] STEP 2: Signing in with email=dev@localhost.com`);
    await page.fill('input[type="email"], input[name="emailOrLdapLoginId"]', "dev@localhost.com");
    await page.fill('input[type="password"]', "DevPass2026!");
    await Promise.all([
      page.waitForNavigation({ timeout: 30000, waitUntil: "domcontentloaded" }).catch(() => {}),
      page.click('button[type="submit"], button:has-text("Sign in")')
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    console.log(`[${ts()}] After signin URL: ${page.url()}`);
    const afterTitle = await page.title();
    console.log(`[${ts()}] After signin Title: ${afterTitle}`);
    const afterBody = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log(`[${ts()}] After signin body: ${afterBody}`);
  } else if (pageType === "first-run-setup-wizard") {
    console.log(`[${ts()}] STEP 2: First-run wizard detected - creating owner account`);
    // Try to fill setup form
    await page.fill('input[name="firstName"], input[placeholder*="first"], input[id*="first"]', "dev").catch(() => {});
    await page.fill('input[name="lastName"], input[placeholder*="last"], input[id*="last"]', "dev").catch(() => {});
    await page.fill('input[type="email"]', "dev@localhost.com").catch(() => {});
    await page.fill('input[type="password"]', "DevPass2026!").catch(() => {});
    const confirmPass = await page.$('input[name="password2"], input[name="confirmPassword"]');
    if (confirmPass) await confirmPass.fill("DevPass2026!");
    await Promise.all([
      page.waitForNavigation({ timeout: 30000, waitUntil: "domcontentloaded" }).catch(() => {}),
      page.click('button[type="submit"]').catch(() => {})
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    console.log(`[${ts()}] After setup URL: ${page.url()}`);
  }

  // Check if we're authenticated
  const postAuthUrl = page.url();
  if (postAuthUrl.includes("/signin") || postAuthUrl.includes("/setup")) {
    // Check for errors
    const errBanner = await page.evaluate(() => {
      const el = document.querySelector('[class*="error"], [class*="alert"], [role="alert"]');
      return el ? el.innerText : "no error banner found";
    });
    console.log(`[${ts()}] WARNING: Still on auth page. Error: ${errBanner}`);
    console.log(`[${ts()}] Current body: ${await page.evaluate(() => document.body.innerText.substring(0, 500))}`);
  }

  // ─── STEP 3: Navigate to Workflows list ─────────────────────────────────────
  console.log(`[${ts()}] STEP 3: Navigating to workflows list`);
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(async () => {
    await page.goto("http://localhost:5678/workflows", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  // Extra wait for dynamic content
  await page.waitForTimeout(3000);

  const workflowsUrl = page.url();
  const workflowsTitle = await page.title();
  const workflowsH1 = await page.$eval("h1", e => e.innerText).catch(() => "none");
  console.log(`[${ts()}] Workflows URL: ${workflowsUrl}`);
  console.log(`[${ts()}] Workflows Title: ${workflowsTitle}`);
  console.log(`[${ts()}] Workflows H1: ${workflowsH1}`);

  // ─── STEP 4: Screenshot of workflows list ────────────────────────────────────
  console.log(`[${ts()}] STEP 4: Capturing workflows list screenshot`);
  const listScreenshot = await page.screenshot({ encoding: "base64", fullPage: false });
  console.log(`SCREENSHOT_WORKFLOWS_LIST_B64_START`);
  console.log(listScreenshot);
  console.log(`SCREENSHOT_WORKFLOWS_LIST_B64_END`);

  // ─── STEP 5 & 6: Enumerate workflows ─────────────────────────────────────────
  console.log(`[${ts()}] STEP 5: Enumerating workflows`);
  await page.waitForTimeout(2000);

  // Try multiple selectors for workflow rows
  const workflowData = await page.evaluate(() => {
    // Try various n8n DOM structures
    const results = [];
    
    // Method 1: table rows
    const rows = document.querySelectorAll('tr[class*="workflow"], tr[data-id], [class*="workflow-row"], [class*="workflowRow"]');
    rows.forEach(row => {
      const name = row.querySelector('td:first-child, [class*="name"], [class*="title"]');
      const status = row.querySelector('[class*="status"], [class*="active"], input[type="checkbox"]');
      results.push({
        method: "row",
        name: name ? name.innerText.trim() : row.innerText.trim().substring(0, 100),
        status: status ? status.innerText || status.getAttribute("data-status") || "found" : "unknown"
      });
    });
    
    if (results.length === 0) {
      // Method 2: cards
      const cards = document.querySelectorAll('[class*="card"], [class*="workflow-card"], [class*="WorkflowCard"]');
      cards.forEach(card => {
        results.push({
          method: "card",
          name: card.innerText.trim().substring(0, 200),
          status: "card"
        });
      });
    }
    
    if (results.length === 0) {
      // Method 3: list items with workflow names
      const items = document.querySelectorAll('[class*="workflow"], [data-test-id*="workflow"]');
      items.forEach(item => {
        results.push({
          method: "generic",
          name: item.innerText.trim().substring(0, 200),
          status: "unknown"
        });
      });
    }
    
    return {
      results,
      fullBodyText: document.body.innerText.substring(0, 5000),
      url: window.location.href
    };
  });

  console.log(`[${ts()}] Workflows enumeration - ${workflowData.results.length} items found`);
  console.log("WORKFLOW_ITEMS:", JSON.stringify(workflowData.results, null, 2));
  console.log("BODY_FOR_WORKFLOW_PARSE:", workflowData.fullBodyText);

  // Target workflows
  const targets = [
    "Brunella Bookkeeping Email Intake Scaffold",
    "Brunella Bookkeeping Reconciliation Scaffold",
    "Brunella Bookkeeping NAV Validation Scaffold",
    "Brunella Bookkeeping Exception Notify Scaffold"
  ];

  // Check target workflow status from body text
  console.log(`[${ts()}] STEP 6: Checking target workflows in body text`);
  for (const target of targets) {
    const found = workflowData.fullBodyText.includes(target) || 
                  workflowData.results.some(r => r.name.includes(target));
    console.log(`TARGET_WORKFLOW: "${target}" -> ${found ? "FOUND" : "NOT FOUND"}`);
  }

  // ─── STEP 7: Open each target workflow ───────────────────────────────────────
  console.log(`[${ts()}] STEP 7: Opening target workflows`);
  
  // Use n8n API to get workflow list
  const apiWorkflows = await page.evaluate(async () => {
    try {
      const resp = await fetch("/rest/workflows?limit=100", {
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      const data = await resp.json();
      return { ok: resp.ok, status: resp.status, data };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log(`[${ts()}] API /rest/workflows response:`);
  console.log("API_WORKFLOWS:", JSON.stringify(apiWorkflows, null, 2));

  // If we have workflow data from API, find and open each target
  let foundWorkflows = [];
  if (apiWorkflows.data && (apiWorkflows.data.data || apiWorkflows.data)) {
    const wfs = apiWorkflows.data.data || apiWorkflows.data;
    if (Array.isArray(wfs)) {
      foundWorkflows = wfs;
      console.log(`[${ts()}] Total workflows from API: ${wfs.length}`);
      console.log("ALL_WORKFLOW_NAMES:", JSON.stringify(wfs.map(w => ({ id: w.id, name: w.name, active: w.active })), null, 2));
    }
  }

  // Open each target workflow
  for (const target of targets) {
    const wf = foundWorkflows.find(w => w.name && w.name.includes(target.split(" ").slice(0, 3).join(" ")));
    let wfId = wf ? wf.id : null;

    // Try exact name match
    const exactMatch = foundWorkflows.find(w => w.name === target);
    if (exactMatch) wfId = exactMatch.id;

    // Partial match
    if (!wfId) {
      const partialKeyword = target.split(" ").slice(2).join(" "); // "Email Intake Scaffold" etc
      const partial = foundWorkflows.find(w => w.name && w.name.includes(partialKeyword));
      if (partial) wfId = partial.id;
    }

    if (!wfId) {
      console.log(`[${ts()}] WORKFLOW "${target}": NOT FOUND in API list`);
      continue;
    }

    console.log(`[${ts()}] Opening workflow "${target}" (id: ${wfId})`);
    try {
      await page.goto(`http://localhost:5678/workflow/${wfId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const editorUrl = page.url();
      const editorTitle = await page.title();
      
      // Check for nodes
      const nodeCount = await page.$$eval('[class*="node"], [data-test-id*="node"], .jtk-endpoint', els => els.length).catch(() => 0);
      const canvasEl = await page.$('[class*="canvas"], [class*="workflow-canvas"], #n8n-canvas, .n8n-canvas').catch(() => null);
      const errorBanner = await page.$('[class*="error"], [role="alert"], [class*="toast"]').catch(() => null);
      const errorText = errorBanner ? await errorBanner.innerText().catch(() => "err el found") : "none";
      const isReadOnly = await page.$('[class*="readonly"], [data-read-only="true"]').catch(() => null);
      const spinner = await page.$('[class*="spinner"], [class*="loading"]').catch(() => null);
      
      // Check unsaved changes indicator
      const unsavedIndicator = await page.evaluate(() => {
        const el = document.querySelector('[class*="unsaved"], [class*="dirty"], [class*="modified"]');
        return el ? el.innerText : "none";
      });
      
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      
      console.log(`[${ts()}] --- WORKFLOW EDITOR: "${target}" ---`);
      console.log(`  URL: ${editorUrl}`);
      console.log(`  Title: ${editorTitle}`);
      console.log(`  Canvas element: ${canvasEl ? "found" : "NOT found"}`);
      console.log(`  Node elements: ${nodeCount}`);
      console.log(`  Error banner: ${errorText}`);
      console.log(`  Read-only: ${isReadOnly ? "yes" : "no"}`);
      console.log(`  Spinner: ${spinner ? "yes - may still loading" : "no"}`);
      console.log(`  Unsaved indicator: ${unsavedIndicator}`);
      console.log(`  Body preview: ${bodyText.substring(0, 500)}`);

      // Screenshot of editor
      const editorScreenshot = await page.screenshot({ encoding: "base64", fullPage: false });
      console.log(`SCREENSHOT_EDITOR_${target.replace(/\s+/g, "_").toUpperCase()}_B64_START`);
      console.log(editorScreenshot);
      console.log(`SCREENSHOT_EDITOR_${target.replace(/\s+/g, "_").toUpperCase()}_B64_END`);

    } catch (e) {
      console.log(`[${ts()}] ERROR opening workflow "${target}": ${e.message}`);
    }
  }

  console.log(`[${ts()}] STEP 8: Automation complete`);
  await browser.close();
})().catch(e => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
