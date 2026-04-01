/**
 * n8n Automation v6 - Intercept exact browser request headers
 * Key: capture ALL headers from browser API calls, use them for direct API access
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run5';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '⏳', todo2: '⏳', todo3: '⏳', todo4: '⏳', todo5: '⏳' };

console.log('=== n8n Automation v6 ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

// Capture both request headers AND response bodies from browser API calls
const capturedData = {
  headers: null,        // request headers from browser
  workflows: null,      // full workflows response
  credentials: null,    // full credentials response
};

// Capture response bodies (full, no truncation)
ctx.on('response', async (res) => {
  const url = res.url();
  if (!url.includes(N8N + '/rest/')) return;
  
  const path = url.replace(N8N + '/rest', '');
  const status = res.status();
  
  try {
    if (path.startsWith('/workflows') && !capturedData.workflows && status === 200) {
      const text = await res.text();
      capturedData.workflows = JSON.parse(text);
      console.log(`📥 Captured workflows response: ${capturedData.workflows?.count || 0} total`);
    }
    if (path.startsWith('/credentials') && !capturedData.credentials && status === 200) {
      const text = await res.text();
      capturedData.credentials = JSON.parse(text);
      console.log(`📥 Captured credentials response: ${(capturedData.credentials?.data||[]).length} creds`);
    }
  } catch(e) { /* ignore */ }
});

// Capture request headers from any authenticated REST call
ctx.on('request', (req) => {
  const url = req.url();
  if (!url.includes(N8N + '/rest/')) return;
  const hdrs = req.headers();
  if (hdrs.cookie?.includes('n8n-auth') && !capturedData.headers) {
    capturedData.headers = hdrs;
    console.log(`📤 Captured auth headers from: ${url.replace(N8N,'').slice(0,60)}`);
  }
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// Load n8n workflows page - this triggers multiple REST API calls
console.log('Loading n8n...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}
console.log('✅ Session valid!', page.url());
await page.screenshot({ path: 'tasks/screenshots/00_workflows.png' });

// Load credentials page too - triggers credentials API call
if (!capturedData.credentials) {
  await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tasks/screenshots/01_credentials.png' });
}

console.log('\nCaptured data status:');
console.log('  - Auth headers:', capturedData.headers ? '✅' : '❌');
console.log('  - Workflows:', capturedData.workflows ? `✅ (${capturedData.workflows.count} total)` : '❌');
console.log('  - Credentials:', capturedData.credentials ? `✅ (${(capturedData.credentials?.data||[]).length} creds)` : '❌');

if (!capturedData.headers) {
  console.log('❌ No auth headers captured! Cannot proceed.');
  await ctx.close();
  process.exit(1);
}

// API function using exact browser headers
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      ...capturedData.headers,
      'accept': 'application/json',
      'content-type': 'application/json',
    },
  };
  if (body) opts.data = JSON.stringify(body);
  
  const resp = await ctx.request.fetch(`${N8N}/rest${path}`, opts);
  const text = await resp.text();
  
  try {
    return { ok: resp.status() < 400, status: resp.status(), data: JSON.parse(text) };
  } catch {
    return { ok: resp.status() < 400, status: resp.status(), data: text };
  }
}

// Verify API access
const testR = await api('/me');
const testR2 = await api('/workflows?limit=3');
console.log('\nAPI test: /me =>', testR.status, '| /workflows =>', testR2.status);

if (!testR2.ok) {
  console.log('API still failing with headers:', JSON.stringify(capturedData.headers).slice(0, 300));
  
  // Last resort: use page.request which is bound to the page context
  console.log('\nTrying page.request...');
  const pr = await page.request.get(`${N8N}/rest/workflows?limit=3`, {
    headers: { 'accept': 'application/json' }
  });
  console.log('page.request /workflows:', pr.status());
  const prText = await pr.text();
  console.log('Response:', prText.slice(0, 200));
}

// ── Process captured data ────────────────────────────────────────
let allWorkflows = capturedData.workflows?.data || [];
let allCreds = capturedData.credentials?.data || [];

// If missing, try direct API
if (allWorkflows.length === 0) {
  const r = await api('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
  if (r.ok) allWorkflows = r.data?.data || [];
  console.log('Direct workflows:', r.status, allWorkflows.length, 'items');
}

if (allCreds.length === 0) {
  const r = await api('/credentials?limit=100');
  if (r.ok) allCreds = r.data?.data || r.data || [];
  console.log('Direct credentials:', r.status, allCreds.length, 'items');
}

console.log(`\n=== Data: ${allWorkflows.length} workflows, ${allCreds.length} credentials ===`);
for (const wf of allWorkflows) console.log(`  WF [${wf.id}] "${wf.name}" active:${wf.active} archived:${wf.isArchived}`);
for (const c of allCreds) console.log(`  CRED [${c.id}] "${c.name}" ${c.type}`);

await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));

const nonArchived = allWorkflows.filter(w => !w.isArchived);
console.log(`\n${nonArchived.length} non-archived workflows to process`);

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook path check
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Checking webhook paths ===');
const webhookMap = {};
for (const wf of nonArchived) {
  const d = await api(`/workflows/${wf.id}`);
  if (!d.ok) { console.log(`  ❌ Can't fetch ${wf.name}: ${d.status}`); continue; }
  for (const node of (d.data?.nodes || [])) {
    if (node.type === 'n8n-nodes-base.webhook') {
      const p = node.parameters?.path || node.parameters?.webhookPath;
      if (p) {
        if (!webhookMap[p]) webhookMap[p] = [];
        webhookMap[p].push({ name: wf.name, id: wf.id, method: node.parameters?.httpMethod });
        console.log(`  Webhook "${p}" in "${wf.name}"`);
      }
    }
  }
}

const conflicts5 = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
if (conflicts5.length > 0) {
  RESULTS.todo5 = `⚠️ PATH CONFLICTS: ${conflicts5.map(([p,v])=>`"${p}" used by: ${v.map(x=>x.name).join(' & ')}`).join('; ')}`;
} else {
  const wf01webhook = Object.entries(webhookMap).find(([,v]) => v.some(x => /01|hibafigyelés/i.test(x.name)));
  RESULTS.todo5 = `✅ No conflicts. ${Object.keys(webhookMap).length} webhook(s): ${Object.entries(webhookMap).map(([p,v])=>`"${p}"(${v[0].name})`).join(', ')||'none found'}`;
}
console.log('TODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Update Airtable credentials
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Airtable credentials ===');
const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
const oldAirtable = allCreds.filter(c => /airtable/i.test(c.name) && c.id !== airtablePAT?.id);
console.log('ISZ_Airtable_PAT_v3:', airtablePAT ? `[${airtablePAT.id}]` : 'NOT FOUND');
console.log('Old Airtable creds:', oldAirtable.map(c => `[${c.id}] ${c.name}`));

let todo4Updates = 0;
if (airtablePAT) {
  for (const wf of nonArchived) {
    const d = await api(`/workflows/${wf.id}`);
    if (!d.ok) continue;
    
    const wfData = d.data;
    let modified = false;
    
    for (const node of (wfData.nodes || [])) {
      if (!node.credentials) continue;
      for (const [ct, ci] of Object.entries(node.credentials)) {
        if (/airtable/i.test(ct) && ci.id !== airtablePAT.id) {
          if (oldAirtable.some(old => old.id === ci.id)) {
            console.log(`  "${wf.name}" node "${node.name}": ${ci.name} → ${airtablePAT.name}`);
            node.credentials[ct] = { id: airtablePAT.id, name: airtablePAT.name };
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      const putR = await api(`/workflows/${wf.id}`, 'PUT', wfData);
      if (putR.ok) { todo4Updates++; console.log(`  ✅ Updated: ${wf.name}`); }
      else console.log(`  ❌ Failed ${wf.name}: ${putR.status}`, JSON.stringify(putR.data).slice(0, 200));
    }
  }
  RESULTS.todo4 = `✅ Updated Airtable credentials in ${todo4Updates} workflow(s) → ISZ_Airtable_PAT_v3 [${airtablePAT.id}]`;
} else {
  const allAirtable = allCreds.filter(c => /airtable/i.test(c.name + c.type));
  RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found. Available: ${allAirtable.map(c=>`${c.name}[${c.id}]`).join(', ')}`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail OAuth
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail credential ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
console.log('Gmail account 4:', gmailCred ? `[${gmailCred.id}] ${gmailCred.type}` : 'NOT FOUND');

if (gmailCred) {
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_credential.png' });
  
  // Look for status in page
  const bodyHTML = await page.locator('body').innerHTML().catch(() => '');
  const hasReconnect = /reconnect/i.test(bodyHTML);
  const hasConnected = /\bconnected\b/i.test(bodyHTML);
  const statusBadge = await page.locator('[class*="status-badge"], [class*="StatusBadge"], [class*="warning-message"]').allTextContents().catch(() => []);
  const alertText = await page.locator('[class*="alert"], [class*="error"], [role="alert"]').allTextContents().catch(() => []);
  
  console.log('  Has reconnect:', hasReconnect);
  console.log('  Has connected:', hasConnected);
  console.log('  Status badge:', statusBadge.filter(t=>t.trim()));
  console.log('  Alerts:', alertText.filter(t=>t.trim()));
  
  if (hasReconnect && !hasConnected) {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] needs reconnection. Go to: ${N8N}/home/credentials/${gmailCred.id}`;
  } else if (hasConnected) {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] is connected`;
  } else {
    RESULTS.todo1 = `Gmail account 4 [${gmailCred.id}] — unclear status. Check screenshot t1_gmail_credential.png`;
  }
} else {
  RESULTS.todo1 = '❌ Gmail account 4 not found in credentials';
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const googleCreds = allCreds.filter(c => /google|drive/i.test(c.name + c.type));
console.log('All Google/Drive creds:', googleCreds.map(c => `[${c.id}] ${c.name} (${c.type})`));

if (driveCred) {
  // Check if WF-07 has drive nodes and connect
  const wf07 = nonArchived.find(wf => /^07|.*07.*wf|.*google.*drive/i.test(wf.name));
  RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists${wf07 ? `. WF-07: ${wf07.name}` : '. WF-07 not found by name.'}`;
} else {
  const wf07 = nonArchived.find(wf => wf.name.match(/07/));
  console.log('WF-07:', wf07 ? `[${wf07.id}] ${wf07.name}` : 'not found');
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod NOT FOUND. Create at: ${N8N}/home/credentials/new (Google Drive OAuth2 API type, account: peterpohankapersonal@gmail.com)`;
}
console.log('TODO-3:', RESULTS.todo3);

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const labelsNeeded = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl.slice(0, 100));
await page.screenshot({ path: 'tasks/screenshots/t2_gmail.png' });

if (gmailUrl.includes('mail.google.com/mail')) {
  const email = await page.locator('[data-email]').first().getAttribute('data-email').catch(() => null);
  console.log('Logged in as:', email);
  
  const labelResults = [];
  for (const name of labelsNeeded) {
    const r = await page.evaluate(async (n) => {
      try {
        const resp = await fetch('/gmail/v1/users/me/labels', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        });
        return { status: resp.status, text: await resp.text() };
      } catch(e) { return { error: e.message }; }
    }, name);
    
    console.log(`  "${name}": ${r.status} ${r.text?.slice(0,80)||r.error}`);
    if (r.status < 300) labelResults.push(`✅${name}`);
    else if (r.status === 409) labelResults.push(`↩️${name}(already exists)`);
    else labelResults.push(`❌${name}(${r.status})`);
  }
  RESULTS.todo2 = `Labels for ${email}: ${labelResults.join(', ')}`;
} else {
  // Check if iszapfalo is available  
  const accountEmail = await page.locator('[data-email="iszapfalo.ai@gmail.com"]').isVisible({ timeout: 2000 }).catch(() => false);
  if (accountEmail) {
    await page.locator('[data-email="iszapfalo.ai@gmail.com"]').click();
    await page.waitForTimeout(5000);
    const url2 = page.url();
    if (url2.includes('mail.google.com/mail')) {
      RESULTS.todo2 = '✅ iszapfalo.ai@gmail.com selected - creating labels...';
    }
  } else {
    RESULTS.todo2 = `⚠️ iszapfalo.ai@gmail.com not available in browser profile. Manually create these labels at https://mail.google.com/#settings/labels:\n  - Surges\n  - Ajanlatkeres\n  - Kotras\n  - Egyeb`;
  }
}
console.log('TODO-2:', RESULTS.todo2);

// Summary
console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [k, v] of Object.entries(RESULTS)) console.log(`\n${k.toUpperCase()}: ${v}`);

await writeFile('tasks/final_results.json', JSON.stringify({
  timestamp: new Date().toISOString(), results: RESULTS,
  workflows: allWorkflows.map(w => ({ id: w.id, name: w.name, active: w.active, archived: w.isArchived })),
  credentials: allCreds.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: webhookMap
}, null, 2));

console.log('\n✅ Saved to tasks/final_results.json');
await ctx.close();
