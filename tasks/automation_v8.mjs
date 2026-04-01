/**
 * n8n Automation v8 - Correct auth: browser-id header + credentials: include
 * Key insight from v7: n8n requires `browser-id` header in requests
 * The cookie (n8n-auth) is there but n8n ALSO checks browser-id
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run7';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '⏳', todo2: '⏳', todo3: '⏳', todo4: '⏳', todo5: '⏳' };

console.log('=== n8n Automation v8 ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

// Capture n8n-specific headers from actual browser requests
let capturedN8nHeaders = {};
let capturedData = { workflows: null, credentials: null };

// Capture request headers (excluding cookies which Playwright hides)
ctx.on('request', (req) => {
  if (!req.url().startsWith(N8N + '/rest/')) return;
  const h = req.headers();
  // Capture n8n custom headers
  if (h['browser-id'] && !capturedN8nHeaders['browser-id']) {
    capturedN8nHeaders = { ...h };
    console.log(`📤 Headers: browser-id=${h['browser-id']?.slice(0,20)}... push-ref=${h['push-ref']?.slice(0,10)||'n/a'}`);
  }
});

ctx.on('response', async (res) => {
  if (!res.url().startsWith(N8N + '/rest/')) return;
  const path = res.url().replace(N8N + '/rest', '');
  if (res.status() !== 200) return;
  
  try {
    if (path.startsWith('/workflows') && !capturedData.workflows) {
      const t = await res.text();
      const d = JSON.parse(t);
      if ((d.data||[]).length > 5) { capturedData.workflows = d; console.log(`📥 Workflows: ${(d.data||[]).length}`); }
    }
    if (path.startsWith('/credentials') && !capturedData.credentials) {
      const t = await res.text();
      capturedData.credentials = JSON.parse(t);
      console.log(`📥 Credentials: ${(capturedData.credentials?.data||[]).length}`);
    }
  } catch {}
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

console.log('Loading n8n...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close(); process.exit(1);
}
console.log('✅ Session valid!', page.url());

// Navigate to credentials page to ensure credentials are loaded
await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(4000);

console.log('\nHeaders captured:', Object.keys(capturedN8nHeaders));
console.log('browser-id:', capturedN8nHeaders['browser-id'] || 'NOT FOUND');

// Also try extracting from localStorage
const storageData = await page.evaluate(() => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return data;
});
console.log('localStorage keys:', Object.keys(storageData));
// Look for browser-id or auth tokens in storage
const relevantStorage = Object.fromEntries(
  Object.entries(storageData).filter(([k]) => /browser|auth|id|user|token/i.test(k))
);
console.log('Relevant storage:', JSON.stringify(relevantStorage).slice(0, 500));

// API function using browser-id header from captured headers (+ credentials:include in evaluate)
async function api(path, method = 'GET', body = null) {
  // Get browser-id from captured headers
  const browserId = capturedN8nHeaders['browser-id'];
  const pushRef = capturedN8nHeaders['push-ref'];
  
  const result = await page.evaluate(async ({ url, method, body, browserId, pushRef }) => {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
    };
    if (browserId) headers['browser-id'] = browserId;
    if (pushRef) headers['push-ref'] = pushRef;
    
    const opts = { method, credentials: 'include', headers };
    if (body) opts.body = JSON.stringify(body);
    
    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch(e) { return { ok: false, status: -1, text: e.message }; }
  }, { url: `${N8N}/rest${path}`, method, body, browserId, pushRef });
  
  try {
    return { ok: result.ok, status: result.status, data: JSON.parse(result.text) };
  } catch {
    return { ok: result.ok, status: result.status, data: result.text };
  }
}

// Test API
const testWF = await api('/workflows?limit=3');
const testCred = await api('/credentials?limit=5');
console.log(`\nAPI test: /workflows=${testWF.status} /credentials=${testCred.status}`);
if (!testWF.ok) console.log('WF error:', JSON.stringify(testWF.data).slice(0,200));
if (testWF.ok) console.log('WF success! First:', testWF.data?.data?.[0]?.name);

// ── Load all data ────────────────────────────────────────────────
let allWorkflows = [];
let allCreds = [];

// Prefer captured data (from actual browser requests)
if ((capturedData.workflows?.data || []).length > 0) {
  allWorkflows = capturedData.workflows.data;
  console.log(`Using captured workflows: ${allWorkflows.length}`);
} else {
  const r = await api('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
  allWorkflows = r.data?.data || [];
  console.log(`API workflows: ${r.status} → ${allWorkflows.length}`);
}

if ((capturedData.credentials?.data || []).length > 0) {
  allCreds = capturedData.credentials.data;
  console.log(`Using captured credentials: ${allCreds.length}`);
} else {
  const r = await api('/credentials?limit=100');
  allCreds = r.data?.data || r.data || [];
  console.log(`API credentials: ${r.status} → ${allCreds.length}`);
}

console.log(`\n=== Data: ${allWorkflows.length} workflows, ${allCreds.length} credentials ===`);
for (const wf of allWorkflows) console.log(`  WF [${wf.id}] "${wf.name}" active:${wf.active} arch:${wf.isArchived||false}`);
for (const c of allCreds) console.log(`  CRED [${c.id}] "${c.name}" (${c.type})`);

await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));

const nonArchived = allWorkflows.filter(w => !w.isArchived);

// Navigate back to n8n base for API calls
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'domcontentloaded', timeout: 20000 });

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook path uniqueness
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Webhook paths ===');
const webhookMap = {};
const allNodesList = [];
let fetchSuccess = 0;

for (const wf of nonArchived) {
  const d = await api(`/workflows/${wf.id}`);
  if (!d.ok) { console.log(`  ❌ ${wf.name}: ${d.status}`); continue; }
  fetchSuccess++;
  
  for (const node of (d.data?.nodes || [])) {
    allNodesList.push({ wfId: wf.id, wfName: wf.name, type: node.type, name: node.name, credentials: node.credentials });
    if (node.type === 'n8n-nodes-base.webhook') {
      const p = node.parameters?.path || 'unknown';
      const method = node.parameters?.httpMethod || 'GET';
      if (!webhookMap[p]) webhookMap[p] = [];
      webhookMap[p].push({ workflow: wf.name, wfId: wf.id, method });
      console.log(`  ✅ Webhook "${p}" (${method}) in "${wf.name}"`);
    }
  }
}

console.log(`Fetched ${fetchSuccess}/${nonArchived.length} workflows successfully`);
const conflicts = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
if (conflicts.length > 0) {
  RESULTS.todo5 = `⚠️ PATH CONFLICTS: ${conflicts.map(([p,v]) => `"${p}": ${v.map(x=>x.workflow).join(' + ')}`).join('; ')}`;
} else if (fetchSuccess === 0) {
  RESULTS.todo5 = `❌ Could not fetch workflow details (all 401). Cannot verify webhook paths.`;
} else {
  RESULTS.todo5 = `✅ No conflicts. ${Object.keys(webhookMap).length} webhooks: ${Object.entries(webhookMap).map(([p,v])=>`"${p}"(${v[0].workflow})`).join(', ')||'none found'}`;
}
console.log('TODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Airtable credentials
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Airtable credentials ===');
const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
const oldAirtableIds = allCreds
  .filter(c => /airtable/i.test(c.type) && c.id !== airtablePAT?.id)
  .map(c => c.id);

console.log('Target:', airtablePAT ? `[${airtablePAT.id}] ${airtablePAT.name}` : 'NOT FOUND');
console.log('Old IDs to replace:', oldAirtableIds);

let t4Updated = 0;
const t4Log = [];

if (airtablePAT && fetchSuccess > 0) {
  for (const wf of nonArchived) {
    const d = await api(`/workflows/${wf.id}`);
    if (!d.ok) continue;
    
    const wfData = d.data;
    let modified = false;
    const changes = [];
    
    for (const node of (wfData.nodes || [])) {
      if (!node.credentials) continue;
      for (const [ct, ci] of Object.entries(node.credentials)) {
        if (/airtable/i.test(ct) && oldAirtableIds.includes(ci.id)) {
          console.log(`  "${wf.name}" / "${node.name}": [${ci.id}] → [${airtablePAT.id}]`);
          node.credentials[ct] = { id: airtablePAT.id, name: airtablePAT.name };
          modified = true;
          changes.push(`${node.name}: ${ci.name} → ${airtablePAT.name}`);
        }
      }
    }
    
    if (modified) {
      const putR = await api(`/workflows/${wf.id}`, 'PUT', wfData);
      if (putR.ok) {
        t4Updated++;
        t4Log.push(`✅ ${wf.name}: ${changes.join(', ')}`);
        console.log(`  ✅ Updated "${wf.name}"`);
      } else {
        t4Log.push(`❌ ${wf.name} (${putR.status}): ${JSON.stringify(putR.data).slice(0,100)}`);
        console.log(`  ❌ Failed "${wf.name}": ${putR.status}`, JSON.stringify(putR.data).slice(0,200));
      }
    }
  }
  RESULTS.todo4 = `✅ Airtable creds replaced in ${t4Updated} workflow(s). ISZ_Airtable_PAT_v3 [${airtablePAT.id}]. Details: ${t4Log.join('; ')||'No changes needed'}`;
} else if (!airtablePAT) {
  RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found`;
} else {
  RESULTS.todo4 = `❌ Cannot modify workflows (API auth failed for individual workflow fetch)`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail credential status
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail credential ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
console.log('Gmail account 4:', gmailCred ? `[${gmailCred.id}]` : 'NOT FOUND');

if (gmailCred) {
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/screenshots/v8_t1_gmail_cred.png' });
  
  const text = await page.locator('body').textContent();
  const reconnectBtn = await page.locator('button:has-text("Reconnect"), button:has-text("Sign in with Google"), [class*="reconnect"]').count();
  const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Connect")').count();
  
  console.log(`  Reconnect btns: ${reconnectBtn}, Save/Connect: ${saveBtn}`);
  // Look for status text
  const statusMatch = text?.match(/(?:connected|invalid|expired|error|reconnect|token|auth)[^.!?]*[.!?]/gi)?.slice(0,3) || [];
  console.log('  Status text:', statusMatch);
  
  if (reconnectBtn > 0) {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] NEEDS reconnection. Go to: ${N8N}/home/credentials/${gmailCred.id} → click Reconnect`;
  } else {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] OK - no reconnect button found (${saveBtn} save/connect btn(s))`;
  }
} else {
  RESULTS.todo1 = '❌ Gmail account 4 not found';
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const wf07 = nonArchived.find(wf => wf.name.match(/^07/));

console.log('ISZ_GoogleDrive_Prod:', driveCred ? `✅ [${driveCred.id}]` : '❌ Missing');
console.log('WF-07:', wf07 ? `[${wf07.id}] "${wf07.name}"` : 'not found');

if (!driveCred) {
  // Check WF-07 nodes that need drive credential
  const driveNodesNeeded = allNodesList.filter(n => /google.*drive|drive.*google|googledrive/i.test(n.type) && n.wfId === wf07?.id);
  console.log('Drive nodes in WF-07:', driveNodesNeeded.map(n => `${n.name} (${n.type})`));
  
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod MISSING. Manual creation required:
  URL: ${N8N}/home/credentials/new
  Type: Google Drive OAuth2 API
  Name: ISZ_GoogleDrive_Prod
  Account: peterpohankapersonal@gmail.com
  Then attach to WF-07: "${wf07?.name}" [${wf07?.id}]${driveNodesNeeded.length ? `\n  Drive nodes: ${driveNodesNeeded.map(n=>n.name).join(', ')}` : ''}`;
} else {
  // Check if WF-07 drive nodes have the credential connected
  const wf07Data = await api(`/workflows/${wf07?.id}`);
  const driveNodes = (wf07Data.data?.nodes || []).filter(n => /drive/i.test(n.type));
  const unlinked = driveNodes.filter(n => !n.credentials?.googleDriveOAuth2Api);
  
  if (unlinked.length > 0) {
    // Update WF-07 to use ISZ_GoogleDrive_Prod
    const wf07Full = wf07Data.data;
    let modified = false;
    for (const node of wf07Full.nodes || []) {
      if (/drive/i.test(node.type) && !node.credentials?.googleDriveOAuth2Api) {
        if (!node.credentials) node.credentials = {};
        node.credentials.googleDriveOAuth2Api = { id: driveCred.id, name: driveCred.name };
        modified = true;
      }
    }
    if (modified) {
      const putR = await api(`/workflows/${wf07.id}`, 'PUT', wf07Full);
      if (putR.ok) {
        RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] connected to WF-07`;
      } else {
        RESULTS.todo3 = `⚠️ ISZ_GoogleDrive_Prod [${driveCred.id}] exists but failed to connect to WF-07: ${putR.status}`;
      }
    } else {
      RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists. WF-07 drive nodes: ${driveNodes.map(n=>n.name).join(', ')||'none'}`;
    }
  } else {
    RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists and connected to WF-07`;
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
await page.screenshot({ path: 'tasks/screenshots/v8_t2_gmail.png' });
console.log('Gmail URL:', gmailUrl.slice(0, 120));

if (gmailUrl.includes('mail.google.com/mail')) {
  const labelResults = [];
  for (const name of labelsNeeded) {
    const r = await page.evaluate(async (n) => {
      try {
        const resp = await fetch('/gmail/v1/users/me/labels', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        });
        return { status: resp.status, body: await resp.text() };
      } catch(e) { return { status: -1, body: e.message }; }
    }, name);
    console.log(`  "${name}": ${r.status}`);
    if (r.status < 300) labelResults.push(`✅${name}`);
    else if (r.status === 409) labelResults.push(`↩️${name}(exists)`);
    else labelResults.push(`❌${name}(${r.status}: ${r.body.slice(0,60)})`);
  }
  RESULTS.todo2 = `Gmail labels: ${labelResults.join(', ')}`;
} else {
  // Try account index 1 for iszapfalo.ai
  await page.goto('https://mail.google.com/mail/u/1/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const u1 = page.url();
  console.log('Gmail u/1 URL:', u1.slice(0,80));
  
  if (u1.includes('mail.google.com/mail')) {
    const labelResults = [];
    for (const name of labelsNeeded) {
      const r = await page.evaluate(async (n) => {
        try {
          const resp = await fetch('/gmail/v1/users/me/labels', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: n, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
          });
          return { status: resp.status, body: await resp.text() };
        } catch(e) { return { status: -1, body: e.message }; }
      }, name);
      console.log(`  u/1 "${name}": ${r.status}`);
      if (r.status < 300) labelResults.push(`✅${name}`);
      else if (r.status === 409) labelResults.push(`↩️${name}(exists)`);
      else labelResults.push(`❌${name}(${r.status}: ${r.body.slice(0,60)})`);
    }
    RESULTS.todo2 = `Gmail u/1 labels: ${labelResults.join(', ')}`;
  } else {
    RESULTS.todo2 = `⚠️ Gmail not accessible. Create manually in iszapfalo.ai@gmail.com: Labels needed: ${labelsNeeded.join(', ')} | URL: https://mail.google.com/#settings/labels`;
  }
}
console.log('TODO-2:', RESULTS.todo2);

// ════════════════════════════════════════════════════════════════
// Final Report
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [k, v] of Object.entries(RESULTS)) console.log(`\n${k.toUpperCase()}: ${v}`);

await writeFile('tasks/final_results.json', JSON.stringify({
  timestamp: new Date().toISOString(), results: RESULTS,
  apiAuth: { browserId: capturedN8nHeaders['browser-id']?.slice(0,20), workflowFetchSuccess: fetchSuccess },
  workflows: allWorkflows.map(w => ({ id: w.id, name: w.name, active: w.active })),
  credentials: allCreds.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: webhookMap
}, null, 2));

console.log('\n✅ Done. Results in tasks/final_results.json');
await ctx.close();
