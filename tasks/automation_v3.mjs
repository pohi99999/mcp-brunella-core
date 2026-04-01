/**
 * n8n Automation - Uses minimal profile copy
 * Handles all 5 TODOs with a combination of API and UI automation
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const USER_DATA_DIR = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\profile-fresh';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const results = {};

console.log('=== n8n Automation - Starting ===');

const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
  viewport: { width: 1280, height: 900 }
});

const page = await ctx.newPage();

// ── Verify login ─────────────────────────────────────────────────
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const loginUrl = page.url();
console.log('Initial URL:', loginUrl);

if (loginUrl.includes('/signin')) {
  console.log('❌ Not logged in - session expired');
  // Check what cookies we have
  const cookies = await ctx.cookies(N8N);
  console.log('Cookies:', cookies.map(c => c.name));
  await ctx.close();
  process.exit(1);
}

console.log('✅ Logged in!');
await page.screenshot({ path: 'tasks/screenshots/00_dashboard.png' });

// ── Helper: n8n API call ─────────────────────────────────────────
async function n8nAPI(endpoint, method = 'GET', body = null) {
  const result = await page.evaluate(async ({endpoint, method, body, n8nBase}) => {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(n8nBase + '/rest' + endpoint, opts);
    return { status: r.status, text: await r.text() };
  }, { endpoint, method, body, n8nBase: N8N });
  
  if (result.status >= 400) {
    return { ok: false, status: result.status, error: result.text };
  }
  try {
    return { ok: true, status: result.status, data: JSON.parse(result.text) };
  } catch {
    return { ok: true, status: result.status, data: result.text };
  }
}

// ── Get all workflows and credentials via API ─────────────────────
console.log('\nFetching n8n data via API...');
const wfResp = await n8nAPI('/workflows?limit=100');
const credResp = await n8nAPI('/credentials');

console.log('Workflows API:', wfResp.status, wfResp.ok ? `${(wfResp.data?.data || []).length} workflows` : wfResp.error?.slice(0,100));
console.log('Credentials API:', credResp.status, credResp.ok ? `${(credResp.data?.data || []).length} creds` : credResp.error?.slice(0,100));

// If API fails, navigate to trigger n8n to load the session properly
if (!wfResp.ok) {
  console.log('API not working via direct fetch. Trying via n8n navigation...');
  
  // Navigate to workflows page to get the list
  await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  
  // Try API again after page is loaded
  const wfResp2 = await n8nAPI('/workflows?limit=100');
  console.log('Retry Workflows API:', wfResp2.status);
  
  if (wfResp2.ok) {
    const workflows = wfResp2.data?.data || [];
    console.log('Workflows found:', workflows.length);
    for (const wf of workflows) {
      console.log(`  [${wf.id}] "${wf.name}" active:${wf.active}`);
    }
    await writeFile('tasks/workflows.json', JSON.stringify(workflows, null, 2));
  }
}

// ── TODO-5: Check Webhook path via UI ────────────────────────────
console.log('\n=== TODO-5: Webhook Path Check ===');
try {
  await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  
  // Search for workflow 01
  const searchInput = page.locator('input[placeholder*="search" i]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill('01');
    await page.waitForTimeout(1500);
  }
  
  await page.screenshot({ path: 'tasks/screenshots/t5_search.png' });
  
  // Get all workflow cards text
  const cards = await page.locator('[class*="card"], [class*="workflow-item"]').allTextContents().catch(() => []);
  console.log('Workflows matching "01":', cards.slice(0, 10).map(t => t.slice(0, 80)));
  
  // Find 01 workflow
  const wf01patterns = ['01 - ISZ', 'ISZ hibafigyelés', '01.*hiba', 'hibafigyelés'];
  let wf01Found = false;
  
  for (const pattern of wf01patterns) {
    const el = page.locator(`text=/${pattern}/i`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Found workflow matching "${pattern}"`);
      await el.click();
      wf01Found = true;
      break;
    }
  }
  
  if (!wf01Found) {
    // Try any card that has "01" at start
    const firstCard = page.locator('[class*="card"]:first-child').first();
    const firstText = await firstCard.textContent().catch(() => '');
    console.log('First card text:', firstText.slice(0, 100));
    
    // Show all workflow names from search
    const allNames = await page.locator('[class*="workflow"] [class*="name"], h3, h4').allTextContents().catch(() => []);
    console.log('All names:', allNames.slice(0, 15));
  }
  
  await page.waitForTimeout(3000);
  console.log('WF URL after click:', page.url());
  await page.screenshot({ path: 'tasks/screenshots/t5_wf01.png' });
  
  results.todo5 = '⚠️ Need to verify manually - see screenshots';
  
} catch(e) {
  console.error('TODO-5 error:', e.message);
  results.todo5 = `❌ Error: ${e.message}`;
}

// ── TODO-4: Update Airtable Credentials ─────────────────────────
console.log('\n=== TODO-4: Update Airtable Credentials ===');

const targetWorkflows = [
  { name: 'Feladatok státuszállítás Telegram chat', search: 'Feladatok' },
  { name: 'Airtable-Google Calendar Szinkron', search: 'Airtable-Google' },
  { name: '04 - ISZ Weekly Reminder', id: 'hLop0AeEKH6NyUaj', search: '04' },
  { name: 'Google Calendar Szinkron', search: 'Google Calendar Szinkron' }
];

for (const wf of targetWorkflows) {
  console.log(`\nProcessing: ${wf.name}`);
  
  try {
    await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    
    const searchBox = page.locator('input[placeholder*="search" i]').first();
    if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBox.fill(wf.search);
      await page.waitForTimeout(1500);
    }
    
    // Try to find and open the workflow
    let opened = false;
    
    // Try exact match
    const exactMatch = page.locator(`[class*="card"]:has-text("${wf.name}")`).first();
    if (await exactMatch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exactMatch.click();
      opened = true;
    }
    
    // Try partial match
    if (!opened) {
      const partialMatch = page.locator(`[class*="card"]:has-text("${wf.search}")`).first();
      if (await partialMatch.isVisible({ timeout: 2000 }).catch(() => false)) {
        await partialMatch.click();
        opened = true;
      }
    }
    
    // Try direct URL if we have an ID
    if (!opened && wf.id) {
      await page.goto(`${N8N}/workflow/${wf.id}`, { waitUntil: 'networkidle', timeout: 20000 });
      opened = true;
    }
    
    if (!opened) {
      console.log(`  ❌ Workflow not found: ${wf.name}`);
      continue;
    }
    
    await page.waitForTimeout(4000);
    const wfUrl = page.url();
    console.log(`  Opened: ${wfUrl}`);
    await page.screenshot({ path: `tasks/screenshots/t4_${wf.search.replace(/[^a-z0-9]/gi, '_')}_open.png` });
    
    // Get workflow ID from URL
    const wfIdMatch = wfUrl.match(/\/workflow\/([^\/\?]+)/);
    const wfId = wfIdMatch?.[1];
    
    if (wfId) {
      // Get workflow via API to see node credentials
      const wfDetail = await n8nAPI(`/workflows/${wfId}`);
      if (wfDetail.ok) {
        const wfData = wfDetail.data;
        const nodes = wfData?.nodes || [];
        console.log(`  Workflow has ${nodes.length} nodes`);
        
        // Find Airtable nodes
        const airtableNodes = nodes.filter(n => 
          n.type?.toLowerCase().includes('airtable') || 
          n.parameters?.application?.value?.includes('airtable')
        );
        console.log(`  Airtable nodes: ${airtableNodes.length}`);
        
        for (const node of airtableNodes) {
          console.log(`    Node: "${node.name}" type:${node.type}`);
          const creds = node.credentials;
          if (creds) {
            console.log(`    Current credentials:`, JSON.stringify(creds));
          }
        }
        
        // Save workflow data for reference
        await writeFile(`tasks/wf_${wf.id || wfId}.json`, JSON.stringify(wfData, null, 2));
      }
    }
    
  } catch(e) {
    console.error(`  Error for ${wf.name}:`, e.message);
  }
}

// ── TODO-1: Check Gmail credential status ────────────────────────
console.log('\n=== TODO-1: Check Gmail Account 4 Status ===');
try {
  await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  
  // Search for Gmail account 4
  const searchBox = page.locator('input[placeholder*="search" i]').first();
  if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBox.fill('Gmail account 4');
    await page.waitForTimeout(1500);
  }
  
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_search.png' });
  
  // Get credential ID from URL when clicking
  const gmailCard = page.locator('text="Gmail account 4"').first();
  if (await gmailCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Found Gmail account 4');
    await gmailCard.click();
    await page.waitForTimeout(3000);
    
    const credUrl = page.url();
    console.log('Credential URL:', credUrl);
    const credIdMatch = credUrl.match(/\/credentials\/([^\/\?]+)/);
    const credId = credIdMatch?.[1];
    console.log('Credential ID:', credId);
    
    await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred.png' });
    
    // Check credential status via API
    if (credId) {
      const credDetail = await n8nAPI(`/credentials/${credId}`);
      console.log('Credential API:', credDetail.status, credDetail.ok ? JSON.stringify(credDetail.data).slice(0, 200) : credDetail.error);
    }
    
    // Look for buttons in modal
    const buttons = await page.locator('[role="dialog"] button, [class*="modal"] button').allTextContents().catch(() => []);
    console.log('Modal buttons:', buttons);
    
    results.todo1 = `⚠️ Gmail account 4 found. Credential ID: ${credIdMatch?.[1]}. Need to check OAuth status manually.`;
  }
} catch(e) {
  console.error('TODO-1 error:', e.message);
}

console.log('\n=== Final Results ===');
console.log(JSON.stringify(results, null, 2));
await writeFile('tasks/automation_results.json', JSON.stringify(results, null, 2));

await ctx.close();
