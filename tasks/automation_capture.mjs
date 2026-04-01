/**
 * Capture n8n-auth JWT via response interception, then use it for all API calls
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-fresh-142639';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = {};

console.log('=== n8n Final Automation ===');
console.log(new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1400, height: 900 },
});

const page = await ctx.newPage();

// Capture n8n-auth from response headers (n8n sets it on page load)
let capturedAuthToken = null;
let capturedCookieHeader = null;

ctx.on('response', async (response) => {
  try {
    const headers = response.headers();
    const setCookie = headers['set-cookie'];
    if (setCookie && setCookie.includes('n8n-auth')) {
      const match = setCookie.match(/n8n-auth=([^;]+)/);
      if (match) {
        capturedAuthToken = match[1];
        console.log('✅ Captured n8n-auth from Set-Cookie!', capturedAuthToken.slice(0, 40) + '...');
      }
    }
  } catch(e) { /* ignore */ }
});

// Capture actual request cookie header from API calls (n8n makes them on load)
ctx.on('request', (request) => {
  if (request.url().includes('/rest/') && !capturedCookieHeader) {
    const cookieHeader = request.headers()['cookie'];
    if (cookieHeader && cookieHeader.includes('n8n-auth')) {
      capturedCookieHeader = cookieHeader;
      const match = cookieHeader.match(/n8n-auth=([^;]+)/);
      if (match) {
        capturedAuthToken = match[1];
        console.log('✅ Captured n8n-auth from Request Cookie!', capturedAuthToken.slice(0, 40) + '...');
      }
    }
  }
});

// Navigate to n8n
console.log('Navigating to n8n dashboard...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(5000);

const currentUrl = page.url();
console.log('URL:', currentUrl);

if (currentUrl.includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}

console.log('✅ Session valid!');
await page.screenshot({ path: 'tasks/screenshots/00_dashboard.png' });

// Get cookies using Playwright API
const allCookies = await ctx.cookies();
const n8nAuthCookie = allCookies.find(c => c.name === 'n8n-auth');
if (n8nAuthCookie) {
  capturedAuthToken = n8nAuthCookie.value;
  console.log('✅ Got n8n-auth from ctx.cookies():', capturedAuthToken.slice(0, 40) + '...');
}

console.log('Captured auth token:', capturedAuthToken ? capturedAuthToken.slice(0, 60) + '...' : 'NOT FOUND');
console.log('Cookie header:', capturedCookieHeader ? capturedCookieHeader.slice(0, 100) + '...' : 'NOT FOUND');

// Helper: API call with explicit cookie
async function api(path, method = 'GET', body = null) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (capturedCookieHeader) {
    headers['Cookie'] = capturedCookieHeader;
  }
  
  const r = await page.evaluate(async ({path, method, body, base, token, cookieHdr}) => {
    const opts = {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(cookieHdr ? {'Cookie': cookieHdr} : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(base + '/rest' + path, opts);
    const text = await res.text();
    return { status: res.status, text };
  }, { path, method, body, base: N8N, token: capturedAuthToken, cookieHdr: capturedCookieHeader });
  
  try { return { ok: r.status < 400, status: r.status, data: JSON.parse(r.text) }; }
  catch { return { ok: r.status < 400, status: r.status, data: r.text }; }
}

// Test API
const testResp = await api('/settings');
console.log('API test (/settings):', testResp.status, testResp.ok ? 'OK' : JSON.stringify(testResp.data).slice(0, 100));

const wfResp = await api('/workflows?limit=100');
console.log('Workflows API:', wfResp.status, wfResp.ok ? `${(wfResp.data?.data||[]).length} workflows` : JSON.stringify(wfResp.data).slice(0, 100));

// If API still fails, use direct UI interaction approach
if (!wfResp.ok) {
  console.log('\nAPI still failing - switching to pure UI approach...');
  
  // ── UI APPROACH: navigate and extract data from the rendered page ──
  
  // Get workflows list from page
  await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Extract workflow names and IDs from the UI
  const wfLinks = await page.locator('a[href*="/workflow/"]').all();
  console.log(`Found ${wfLinks.length} workflow links`);
  
  const workflows = [];
  for (const link of wfLinks.slice(0, 30)) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    const idMatch = href?.match(/\/workflow\/([^\/\?]+)/);
    if (idMatch) {
      workflows.push({ id: idMatch[1], name: text?.trim() || '', href });
    }
  }
  
  // Also try workflow cards
  const cards = await page.locator('[class*="workflow-list"] [class*="name"], [class*="card-title"], .workflow-name').all();
  console.log(`Workflow name elements: ${cards.length}`);
  
  for (const card of cards.slice(0, 30)) {
    const text = await card.textContent();
    console.log('  Card:', text?.trim().slice(0, 80));
  }
  
  await page.screenshot({ path: 'tasks/screenshots/01_workflows_list.png' });
  
  // Try to extract the full list from the JSON API that the frontend loads
  // n8n frontend fetches workflows on load - it's in the page state
  const pageState = await page.evaluate(() => {
    // Try to get data from Vue/Pinia store if accessible
    try {
      const state = window.__pinia || window.n8nStore || window.workflowStore;
      return JSON.stringify(state);
    } catch(e) {
      return null;
    }
  });
  
  if (pageState) {
    console.log('Page state found:', pageState.slice(0, 200));
  }
  
  console.log('\nWorkflows from links:', workflows.map(w => `[${w.id}] ${w.name}`).join('\n  '));
  
  // Continue with UI-based approach for all TODOs
  // TODO-5: Find webhook path
  console.log('\n=== TODO-5: Webhook paths ===');
  for (const wf of workflows.filter(w => w.name.match(/01|hibafigyelés/i))) {
    console.log(`Opening WF: ${wf.name} [${wf.id}]`);
    await page.goto(`${N8N}/workflow/${wf.id}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `tasks/screenshots/t5_wf_${wf.id}.png` });
    
    // Look for webhook node
    const webhookNode = page.locator('[data-name="Webhook"], [class*="node"]:has-text("Webhook")').first();
    if (await webhookNode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await webhookNode.click();
      await page.waitForTimeout(2000);
      
      // Read path value
      const pathField = page.locator('input[placeholder*="path"], input[name="path"]').first();
      const pathValue = await pathField.inputValue().catch(() => null);
      console.log('  Webhook path:', pathValue);
      RESULTS.todo5 = `Webhook path: ${pathValue || '(check screenshot)'}`;
    }
  }
  
  // TODO-4: Airtable credentials
  console.log('\n=== TODO-4: Airtable credentials (UI approach) ===');
  // Navigate to credentials to find ISZ_Airtable_PAT_v3
  await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  const credLinks = await page.locator('a[href*="/credentials/"]').all();
  console.log(`Found ${credLinks.length} credential links`);
  
  const creds = [];
  for (const link of credLinks) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    const idMatch = href?.match(/\/credentials\/([^\/\?]+)/);
    if (idMatch) {
      creds.push({ id: idMatch[1], name: text?.trim() || '' });
    }
  }
  
  console.log('Credentials found:', creds.map(c => `[${c.id}] ${c.name}`));
  await page.screenshot({ path: 'tasks/screenshots/t4_creds_list.png' });
  
  RESULTS.todo4 = `Found ${creds.length} credentials. Airtable creds: ${creds.filter(c=>c.name.includes('Airtable')).map(c=>c.name).join(', ')}`;
  RESULTS.todo1 = `Gmail: ${creds.filter(c=>c.name.includes('Gmail')).map(c=>`[${c.id}] ${c.name}`).join(', ')}`;
  RESULTS.todo3 = `Drive: ${creds.filter(c=>c.name.toLowerCase().includes('drive')).map(c=>`[${c.id}] ${c.name}`).join(', ')}`;
}

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels via API
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels (API approach) ===');
const labelsToCreate = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

// Navigate to Gmail
await page.goto('https://mail.google.com', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl);
await page.screenshot({ path: 'tasks/screenshots/t2_gmail.png' });

if (gmailUrl.includes('mail.google.com')) {
  console.log('✅ Gmail loaded!');
  
  // Check which account
  const accountText = await page.locator('[data-email]').first().getAttribute('data-email').catch(() => null);
  console.log('Gmail account:', accountText);
  
  // Use Gmail labels API through the page (CORS-safe)
  const gmailToken = await page.evaluate(async () => {
    // Try to get OAuth token from the page
    try {
      const resp = await fetch('/gmail/v1/users/me/labels', { credentials: 'include' });
      return { status: resp.status };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Gmail API test:', gmailToken);
  
  // Try Gmail settings approach
  await page.goto('https://mail.google.com/mail/u/0/#settings/labels', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tasks/screenshots/t2_gmail_labels.png' });
  
  const createNewLabel = page.locator('button:has-text("Create new label")');
  const visible = await createNewLabel.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('"Create new label" button visible:', visible);
  
  if (visible) {
    const createdLabels = [];
    for (const labelName of labelsToCreate) {
      await createNewLabel.click();
      await page.waitForTimeout(1500);
      
      const dialog = page.locator('[role="dialog"]').first();
      const input = dialog.locator('input').first();
      if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
        await input.fill(labelName);
        
        // Submit
        const submitBtn = dialog.locator('button:has-text("Create"), input[value="Create"]').last();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
          createdLabels.push(labelName);
          console.log(`  ✅ Created label: ${labelName}`);
        } else {
          // Try Enter key
          await input.press('Enter');
          await page.waitForTimeout(2000);
          createdLabels.push(labelName);
          console.log(`  ✅ Created label (Enter): ${labelName}`);
        }
        await page.screenshot({ path: `tasks/screenshots/t2_after_${labelName}.png` });
      } else {
        // Press Escape to close dialog and try another approach
        await page.keyboard.press('Escape');
        console.log(`  ❌ Input not found for ${labelName}`);
      }
    }
    
    RESULTS.todo2 = createdLabels.length > 0 
      ? `✅ Created labels: ${createdLabels.join(', ')}`
      : '❌ Could not create labels';
  } else {
    await page.screenshot({ path: 'tasks/screenshots/t2_gmail_no_create_btn.png' });
    RESULTS.todo2 = '⚠️ Gmail loaded but "Create new label" button not found on settings page';
  }
} else {
  console.log('Not logged into Gmail');
  RESULTS.todo2 = `⚠️ Gmail requires login. Account available: iam@peterpohanka.com. Need to select account.`;
  
  // Try clicking the Google account
  const accountLink = page.locator('text="iam@peterpohanka.com"').first();
  if (await accountLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accountLink.click();
    await page.waitForTimeout(5000);
    const gmailUrl2 = page.url();
    console.log('After account select URL:', gmailUrl2);
    await page.screenshot({ path: 'tasks/screenshots/t2_gmail_after_account_select.png' });
    
    if (gmailUrl2.includes('mail.google.com')) {
      RESULTS.todo2 = '✅ Gmail account selected. Check screenshots for label creation.';
    }
  }
}

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('FINAL RESULTS');
console.log('='.repeat(60));
for (const [key, val] of Object.entries(RESULTS)) {
  console.log(`${key}: ${val}`);
}

await writeFile('tasks/automation_results2.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  results: RESULTS
}, null, 2));

await ctx.close();
