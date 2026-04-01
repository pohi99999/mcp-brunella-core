/**
 * n8n Automation v7 - page.evaluate() for all API calls
 * Key insight: run fetch() inside the browser page to get full auth context
 * READ: capture responses from browser's own API calls  
 * WRITE: page.evaluate() with fetch() gets cookie+CSRF automatically
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run6';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '⏳', todo2: '⏳', todo3: '⏳', todo4: '⏳', todo5: '⏳' };

console.log('=== n8n Automation v7 (page.evaluate) ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

// Capture full responses from browser's own API calls
const capturedData = { workflows: null, credentials: null, requestHeaders: null };

// Log ALL headers from any REST request (no filtering)
ctx.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/rest/') || !url.includes(N8N)) return;
  const hdrs = req.headers();
  if (!capturedData.requestHeaders) {
    capturedData.requestHeaders = hdrs;
    console.log(`📤 Request headers from: ${url.replace(N8N,'').slice(0,50)}`);
    console.log(`    cookie present: ${!!hdrs.cookie}, length: ${hdrs.cookie?.length}`);
    console.log(`    keys: ${Object.keys(hdrs).join(', ')}`);
  }
});

ctx.on('response', async (res) => {
  const url = res.url();
  if (!url.includes(N8N + '/rest/')) return;
  const path = url.replace(N8N + '/rest', '');
  const status = res.status();
  
  try {
    if (path.startsWith('/workflows') && !capturedData.workflows && status === 200) {
      const text = await res.text();
      const parsed = JSON.parse(text);
      capturedData.workflows = parsed;
      const arr = parsed.data || [];
      console.log(`📥 Workflows response: count=${parsed.count} data=${arr.length}`);
    }
    if (path.startsWith('/credentials') && !capturedData.credentials && status === 200) {
      const text = await res.text();
      capturedData.credentials = JSON.parse(text);
      console.log(`📥 Credentials response: ${(capturedData.credentials?.data||[]).length} creds`);
    }
  } catch(e) {}
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

console.log('Loading n8n workflows page...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired! Profile already used.');
  await ctx.close(); process.exit(1);
}
console.log('✅ Session valid!', page.url());
await page.screenshot({ path: 'tasks/screenshots/v7_00_workflows.png' });

// Navigate to credentials page to trigger that API call
await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(4000);

// API calls using page.evaluate (runs inside browser with full auth)
async function api(path, method = 'GET', body = null) {
  const result = await page.evaluate(async ({ url, method, body }) => {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'accept': 'application/json', 'content-type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch(e) {
      return { ok: false, status: 0, text: e.message };
    }
  }, { url: `${N8N}/rest${path}`, method, body });
  
  try {
    return { ok: result.ok, status: result.status, data: JSON.parse(result.text) };
  } catch {
    return { ok: result.ok, status: result.status, data: result.text };
  }
}

// Verify API access via page.evaluate
const testMe = await api('/me');
const testWF = await api('/workflows?limit=5');
console.log(`\nAPI via page.evaluate: /me=${testMe.status} /workflows=${testWF.status}`);
if (testMe.ok) console.log(`  Logged in as: ${testMe.data?.email || JSON.stringify(testMe.data).slice(0,100)}`);
if (!testWF.ok) console.log(`  Workflows error: ${JSON.stringify(testWF.data).slice(0,200)}`);

// ── Load all data ────────────────────────────────────────────────
let allWorkflows = capturedData.workflows?.data || [];
let allCreds = capturedData.credentials?.data || [];

// Fallback to direct API
if (allWorkflows.length === 0) {
  const r = await api('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
  if (r.ok) allWorkflows = r.data?.data || [];
  console.log(`Direct /workflows: ${r.status}, got ${allWorkflows.length}`);
}
if (allCreds.length === 0) {
  const r = await api('/credentials?limit=100');
  if (r.ok) allCreds = r.data?.data || r.data || [];
  console.log(`Direct /credentials: ${r.status}, got ${allCreds.length}`);
}

console.log(`\n=== Data: ${allWorkflows.length} workflows, ${allCreds.length} credentials ===`);
for (const wf of allWorkflows) {
  console.log(`  WF [${wf.id}] "${wf.name}" active:${wf.active} archived:${wf.isArchived||false}`);
}
for (const c of allCreds) {
  console.log(`  CRED [${c.id}] "${c.name}" ${c.type}`);
}

await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));

const nonArchived = allWorkflows.filter(w => !w.isArchived);
console.log(`\n${nonArchived.length} non-archived workflows`);

// Navigate page to n8n base URL so API calls work
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'domcontentloaded', timeout: 20000 });

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook path uniqueness check
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Webhook paths ===');
const webhookMap = {};
const allNodes = [];

for (const wf of nonArchived) {
  const d = await api(`/workflows/${wf.id}`);
  if (!d.ok) { console.log(`  ❌ ${wf.name}: ${d.status}`); continue; }
  
  for (const node of (d.data?.nodes || [])) {
    allNodes.push({ wf: wf.name, wfId: wf.id, ...node });
    if (node.type === 'n8n-nodes-base.webhook') {
      const p = node.parameters?.path || node.parameters?.webhookPath || 'unknown';
      const method = node.parameters?.httpMethod || 'GET';
      if (!webhookMap[p]) webhookMap[p] = [];
      webhookMap[p].push({ workflow: wf.name, wfId: wf.id, method });
      console.log(`  Webhook: "${p}" (${method}) in "${wf.name}"`);
    }
  }
}

const conflicts = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
if (conflicts.length > 0) {
  RESULTS.todo5 = `⚠️ CONFLICTS: ${conflicts.map(([p,v]) => `"${p}": ${v.map(x=>x.workflow).join(' + ')}`).join('; ')}`;
} else {
  RESULTS.todo5 = `✅ No webhook path conflicts. ${Object.keys(webhookMap).length} webhook(s): ${Object.entries(webhookMap).map(([p,v]) => `"${p}"→${v[0].workflow}`).join(', ')||'none'}`;
}
console.log('TODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Replace old Airtable credentials
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Airtable credentials ===');
const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
const airtableV2 = allCreds.find(c => c.name === 'ISZ_Airtable_Prod_v2');
const airtableOld = allCreds.find(c => c.name === 'ISZ_Airtable_Prod' && c.id !== airtablePAT?.id);
const oldIds = [airtableV2?.id, airtableOld?.id].filter(Boolean);

console.log('Target ISZ_Airtable_PAT_v3:', airtablePAT ? `[${airtablePAT.id}]` : 'NOT FOUND');
console.log('Old creds to replace:', oldIds);

let todo4Updates = 0;
const todo4Details = [];

if (airtablePAT) {
  for (const wf of nonArchived) {
    const d = await api(`/workflows/${wf.id}`);
    if (!d.ok) continue;
    
    const wfData = d.data;
    const nodes = wfData.nodes || [];
    let modified = false;
    const changedNodes = [];
    
    for (const node of nodes) {
      if (!node.credentials) continue;
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        if (/airtable/i.test(credType) && oldIds.includes(credInfo.id)) {
          console.log(`  "${wf.name}" node "${node.name}": [${credInfo.id}] ${credInfo.name} → ISZ_Airtable_PAT_v3`);
          node.credentials[credType] = { id: airtablePAT.id, name: airtablePAT.name };
          modified = true;
          changedNodes.push(node.name);
        }
      }
    }
    
    if (modified) {
      const putR = await api(`/workflows/${wf.id}`, 'PUT', wfData);
      if (putR.ok) {
        todo4Updates++;
        todo4Details.push(`${wf.name} (nodes: ${changedNodes.join(', ')})`);
        console.log(`  ✅ Updated: ${wf.name}`);
      } else {
        console.log(`  ❌ Failed ${wf.name}: ${putR.status}`, JSON.stringify(putR.data).slice(0, 300));
        todo4Details.push(`FAILED: ${wf.name} (${putR.status})`);
      }
    }
  }
  RESULTS.todo4 = `✅ Airtable creds replaced in ${todo4Updates} workflow(s). Details: ${todo4Details.join('; ') || 'No workflows needed update'}. Target: ISZ_Airtable_PAT_v3 [${airtablePAT.id}]`;
} else {
  RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found. Available: ${allCreds.filter(c=>/airtable/i.test(c.name+c.type)).map(c=>`${c.name}[${c.id}]`).join(', ')}`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail OAuth status
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail OAuth ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
if (gmailCred) {
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/screenshots/v7_t1_gmail.png' });
  
  const html = await page.locator('body').innerHTML();
  const textContent = await page.locator('body').textContent();
  
  // Look for error/warning indicators
  const hasError = /expir|invalid|reconnect|error/i.test(textContent);
  const hasConnected = /connected|valid/i.test(textContent);
  const reconnectBtn = await page.locator('button:has-text("Reconnect"), button:has-text("Connect")').count();
  
  console.log(`  Error indicators: ${hasError}, Connected: ${hasConnected}, Reconnect btns: ${reconnectBtn}`);
  
  // Check if there's a red/warning status indicator
  const statusElements = await page.locator('[class*="error"], [class*="warning"], [class*="danger"], [class*="success"], [class*="connected"]').allTextContents();
  console.log('  Status elements:', statusElements.filter(t => t.trim()).slice(0, 5));
  
  if (reconnectBtn > 0 || (hasError && !hasConnected)) {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] appears to need reconnection. Manual action needed at: ${N8N}/home/credentials/${gmailCred.id}`;
  } else {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] - no reconnection required (${hasConnected ? 'connected' : 'no error indicators'})`;
  }
} else {
  RESULTS.todo1 = '❌ Gmail account 4 not found';
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive credential ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const googleDriveNodes = allNodes.filter(n => /google.*drive|drive.*google/i.test(n.type));

console.log('ISZ_GoogleDrive_Prod:', driveCred ? `✅ [${driveCred.id}]` : '❌ Not found');
console.log('Google Drive nodes in workflows:', googleDriveNodes.map(n => `${n.wf}: ${n.name}`));

if (!driveCred) {
  // Check if WF-07 exists and what drive cred it references
  const wf07 = nonArchived.find(wf => wf.name.match(/07/i) || wf.name.toLowerCase().includes('drive'));
  console.log('WF-07:', wf07 ? `[${wf07.id}] "${wf07.name}"` : 'not found');
  
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod credential does NOT exist. Must be created manually:
  1. Go to: ${N8N}/home/credentials/new
  2. Select "Google Drive OAuth2 API"  
  3. Name it: ISZ_GoogleDrive_Prod
  4. Connect with account: peterpohankapersonal@gmail.com
  ${wf07 ? `5. Then connect to workflow: "${wf07.name}" [${wf07.id}]` : ''}`;
} else {
  // Connect to WF-07 if needed
  const wf07 = nonArchived.find(wf => wf.name.match(/07/i));
  if (wf07 && googleDriveNodes.some(n => n.wf === wf07.name && !n.credentials)) {
    RESULTS.todo3 = `⚠️ ISZ_GoogleDrive_Prod exists [${driveCred.id}] but WF-07 nodes may need to be connected`;
  } else {
    RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod exists [${driveCred.id}]`;
  }
}
console.log('TODO-3:', RESULTS.todo3);

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const labelsNeeded = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl.slice(0, 100));
await page.screenshot({ path: 'tasks/screenshots/v7_t2_gmail.png' });

const isGmailLoaded = gmailUrl.includes('mail.google.com/mail');

if (isGmailLoaded) {
  // Detect which account is loaded
  const emailAttr = await page.locator('[data-email]').first().getAttribute('data-email').catch(() => null);
  const accountEl = await page.locator('[aria-label*="Google Account"], [data-identifier]').first().getAttribute('aria-label').catch(() => null);
  console.log('  email attr:', emailAttr, '| account label:', accountEl?.slice(0,50));
  
  // Try to get the Gmail API auth token for creating labels
  const labelResults = [];
  
  for (const name of labelsNeeded) {
    const result = await page.evaluate(async (labelName) => {
      try {
        const resp = await fetch('/gmail/v1/users/me/labels', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ 
            name: labelName,
            labelListVisibility: 'labelShow', 
            messageListVisibility: 'show'
          })
        });
        const text = await resp.text();
        return { status: resp.status, body: text };
      } catch(e) { return { status: -1, body: e.message }; }
    }, name);
    
    console.log(`  Label "${name}": ${result.status} ${result.body.slice(0,100)}`);
    if (result.status === 200) labelResults.push(`✅${name}`);
    else if (result.status === 409) labelResults.push(`↩️${name}(exists)`);
    else labelResults.push(`❌${name}(${result.status})`);
  }
  
  RESULTS.todo2 = `Labels for ${emailAttr||'loaded account'}: ${labelResults.join(', ')}`;
  
} else {
  // Check if we can switch accounts
  console.log('  Gmail not loaded. Checking for account chooser...');
  await page.screenshot({ path: 'tasks/screenshots/v7_t2_gmail_chooser.png' });
  
  const iszapfaloBtns = await page.locator('[data-email="iszapfalo.ai@gmail.com"], a:has-text("iszapfalo.ai@gmail.com")').count();
  const iamBtns = await page.locator('[data-email="iam@peterpohanka.com"], a:has-text("iam@peterpohanka.com")').count();
  console.log(`  iszapfalo.ai buttons: ${iszapfaloBtns}, iam@ buttons: ${iamBtns}`);
  
  RESULTS.todo2 = `⚠️ Gmail not accessible in browser session (URL: ${gmailUrl.slice(0,80)}). 
  Manual action needed: Create these 4 labels in https://mail.google.com for iszapfalo.ai@gmail.com:
  1. Surges
  2. Ajanlatkeres
  3. Kotras
  4. Egyeb
  Go to: https://mail.google.com/#settings/labels → "Create new label"`;
}
console.log('TODO-2:', RESULTS.todo2);

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [k, v] of Object.entries(RESULTS)) console.log(`\n${k.toUpperCase()}: ${v}`);

const finalData = {
  timestamp: new Date().toISOString(),
  results: RESULTS,
  workflows: allWorkflows.map(w => ({ id: w.id, name: w.name, active: w.active, archived: w.isArchived||false })),
  credentials: allCreds.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: webhookMap,
  requestHeaders: capturedData.requestHeaders ? Object.keys(capturedData.requestHeaders) : []
};
await writeFile('tasks/final_results.json', JSON.stringify(finalData, null, 2));
console.log('\n✅ Results saved to tasks/final_results.json');

await ctx.close();
