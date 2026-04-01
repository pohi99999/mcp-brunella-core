/**
 * n8n Targeted Automation - Fixed version
 * Using intercepted headers for all API calls, no truncation
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run3';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '', todo2: '', todo3: '', todo4: '', todo5: '' };

console.log('=== n8n Targeted Automation ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

// Capture working request headers
let workingHeaders = null;
ctx.on('request', req => {
  if (req.url().includes(N8N + '/rest/workflows') && !workingHeaders) {
    const hdrs = req.headers();
    if (hdrs.cookie) {
      workingHeaders = hdrs;
      console.log('✅ Captured working headers from /rest/workflows request');
    }
  }
});

const page = await ctx.newPage();
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}
console.log('✅ Session valid!');

// Ensure we have working headers (fallback to cookies)
if (!workingHeaders) {
  const cookies = await ctx.cookies();
  const n8nCookie = cookies.find(c => c.name === 'n8n-auth');
  if (n8nCookie) {
    workingHeaders = { 'cookie': `n8n-auth=${n8nCookie.value}`, 'accept': 'application/json' };
    console.log('Using n8n-auth cookie as header');
  }
}

console.log('Headers cookie prefix:', workingHeaders?.cookie?.slice(0, 40));

// ── API helper using ctx.request (Node.js level) ─────────────────
async function api(path, method = 'GET', body = null) {
  const hdrs = {
    ...(workingHeaders || {}),
    'accept': 'application/json',
    'content-type': 'application/json',
  };
  
  const opts = { method, headers: hdrs };
  if (body) opts.data = JSON.stringify(body);
  
  const resp = await ctx.request.fetch(`${N8N}/rest${path}`, opts);
  const text = await resp.text();
  
  try {
    return { ok: resp.status() < 400, status: resp.status(), data: JSON.parse(text) };
  } catch {
    return { ok: resp.status() < 400, status: resp.status(), data: text };
  }
}

// ── Fetch ALL workflows (no truncation!) ─────────────────────────
console.log('\n[1] Fetching all workflows...');
const wfResp = await api('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
console.log('Workflows API:', wfResp.status, typeof wfResp.data);

let allWorkflows = [];
if (wfResp.ok) {
  allWorkflows = wfResp.data?.data || [];
  console.log(`Got ${allWorkflows.length} workflows (count: ${wfResp.data?.count})`);
  for (const wf of allWorkflows) {
    console.log(`  [${wf.id}] "${wf.name}" active:${wf.active} archived:${wf.isArchived}`);
  }
} else {
  // Try without filter
  const wfResp2 = await api('/workflows?limit=200');
  if (wfResp2.ok) {
    allWorkflows = wfResp2.data?.data || wfResp2.data || [];
    console.log(`Got ${allWorkflows.length} workflows (alt endpoint)`);
  }
}

// ── Fetch all credentials ────────────────────────────────────────
console.log('\n[2] Fetching credentials...');
const credResp = await api('/credentials?limit=100');
let allCreds = [];
if (credResp.ok) {
  allCreds = credResp.data?.data || credResp.data || [];
  console.log(`Got ${allCreds.length} credentials:`);
  for (const c of allCreds) {
    console.log(`  [${c.id}] "${c.name}" type:${c.type}`);
  }
} else {
  console.log('Credentials API failed:', credResp.status);
}

await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook path check
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Webhook paths ===');
const allWebhookPaths = {};
const nonArchivedWFs = allWorkflows.filter(wf => !wf.isArchived);
console.log(`Checking ${nonArchivedWFs.length} non-archived workflows for webhooks...`);

for (const wf of nonArchivedWFs) {
  const detail = await api(`/workflows/${wf.id}`);
  if (detail.ok) {
    const nodes = detail.data?.nodes || [];
    for (const node of nodes) {
      if (node.type === 'n8n-nodes-base.webhook') {
        const path = node.parameters?.path || node.parameters?.webhookPath;
        const method = node.parameters?.httpMethod || 'GET';
        if (path) {
          if (!allWebhookPaths[path]) allWebhookPaths[path] = [];
          allWebhookPaths[path].push({ wfId: wf.id, wfName: wf.name, method, nodeName: node.name });
        }
      }
    }
  }
}

console.log('All webhook paths:', JSON.stringify(allWebhookPaths, null, 2));

const conflicts = Object.entries(allWebhookPaths).filter(([, uses]) => uses.length > 1);
if (conflicts.length > 0) {
  RESULTS.todo5 = `⚠️ CONFLICTS: ${conflicts.map(([p, u]) => `"${p}" in ${u.map(x=>x.wfName).join(' & ')}`).join('; ')}`;
} else if (Object.keys(allWebhookPaths).length === 0) {
  RESULTS.todo5 = '✅ No webhook trigger nodes found in active workflows';
} else {
  const paths = Object.entries(allWebhookPaths).map(([p, u]) => `"${p}" (${u[0].wfName})`).join(', ');
  RESULTS.todo5 = `✅ No conflicts. Webhook paths: ${paths}`;
}
console.log('TODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Update Airtable credentials
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Update Airtable credentials ===');
const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
const oldAirtableCreds = allCreds.filter(c => /airtable/i.test(c.name) && c.id !== airtablePAT?.id);

console.log(`Target cred: ${airtablePAT ? `[${airtablePAT.id}] ${airtablePAT.name}` : 'NOT FOUND'}`);
console.log(`Old Airtable creds to replace: ${oldAirtableCreds.map(c => `[${c.id}] ${c.name}`).join(', ')}`);

let todo4Updated = 0;
let todo4Checked = 0;

if (airtablePAT) {
  // Check ALL active non-archived workflows for Airtable nodes
  for (const wf of nonArchivedWFs) {
    const detail = await api(`/workflows/${wf.id}`);
    if (!detail.ok) continue;
    
    const wfData = detail.data;
    const nodes = wfData.nodes || [];
    let modified = false;
    const changes = [];
    
    for (const node of nodes) {
      if (!node.credentials) continue;
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        if (/airtable/i.test(credType) || oldAirtableCreds.some(c => c.id === credInfo.id)) {
          todo4Checked++;
          if (credInfo.id !== airtablePAT.id) {
            changes.push(`"${node.name}": ${credInfo.name} [${credInfo.id}] → ${airtablePAT.name} [${airtablePAT.id}]`);
            node.credentials[credType] = { id: airtablePAT.id, name: airtablePAT.name };
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      console.log(`\nUpdating "${wf.name}":`);
      changes.forEach(c => console.log(`  ${c}`));
      
      const putResp = await api(`/workflows/${wf.id}`, 'PUT', wfData);
      if (putResp.ok) {
        console.log(`  ✅ Success`);
        todo4Updated++;
      } else {
        console.log(`  ❌ Failed: ${putResp.status}`, JSON.stringify(putResp.data).slice(0, 150));
      }
    }
  }
  
  RESULTS.todo4 = `✅ Updated Airtable creds in ${todo4Updated} workflows (checked ${nonArchivedWFs.length}, found Airtable nodes in ${todo4Checked})`;
} else {
  RESULTS.todo4 = `❌ ISZ_Airtable_PAT_v3 not found`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail OAuth credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail credential ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
console.log('Gmail account 4:', gmailCred ? `[${gmailCred.id}] type:${gmailCred.type}` : 'NOT FOUND');

if (gmailCred) {
  // Navigate to credential page to check status
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred.png' });
  
  // Read all text from the credential modal/page
  const bodyText = await page.locator('body').textContent().catch(() => '');
  
  // Look for status indicators
  const statusEls = await page.locator('[class*="status"], [class*="badge"], [class*="warning"], [class*="error"], [class*="success"]').allTextContents().catch(() => []);
  console.log('Status elements:', statusEls.filter(t => t.trim()).slice(0, 10));
  
  // Look for "Reconnect" or "Connected" text
  const reconnectBtn = page.locator('button:has-text("Reconnect"), button:has-text("Connect"), a:has-text("Reconnect")');
  const hasReconnect = await reconnectBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const connectedEl = page.locator('text="Connected", [class*="connected"]');
  const hasConnected = await connectedEl.isVisible({ timeout: 3000 }).catch(() => false);
  
  console.log('Has Reconnect button:', hasReconnect);
  console.log('Has Connected indicator:', hasConnected);
  
  if (hasReconnect) {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] needs reconnection. Open ${N8N}/home/credentials/${gmailCred.id} and click Reconnect.`;
    console.log('  → Clicking Reconnect button...');
    await reconnectBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/screenshots/t1_gmail_reconnect_click.png' });
    const afterUrl = page.url();
    console.log('  After click URL:', afterUrl);
    
    if (afterUrl.includes('accounts.google.com') || afterUrl.includes('oauth')) {
      RESULTS.todo1 = `⚠️ Gmail account 4 - OAuth reconnect triggered but requires manual approval at Google. URL: ${afterUrl}`;
    }
  } else if (hasConnected) {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] is connected`;
  } else {
    RESULTS.todo1 = `Gmail account 4 [${gmailCred.id}] status unclear. Check screenshot: tasks/screenshots/t1_gmail_cred.png`;
  }
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const googleCreds = allCreds.filter(c => /google|drive|gDrive/i.test(c.name + c.type));
console.log('Google creds:', googleCreds.map(c => `[${c.id}] ${c.name} (${c.type})`));

if (driveCred) {
  RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] already exists`;
  
  // Find WF-07 by pattern
  const wf07 = allWorkflows.find(wf => 
    wf.name.match(/^07|.*google.*drive.*wf|.*wf.*drive/i)
  );
  if (wf07) {
    RESULTS.todo3 += `. WF-07 "${wf07.name}" found.`;
  } else {
    const driveWFs = nonArchivedWFs.filter(wf => /drive/i.test(wf.name));
    RESULTS.todo3 += `. Drive WFs: ${driveWFs.map(w => w.name).join(', ')}`;
  }
} else {
  // Check if we need to create it  
  const wf07 = allWorkflows.find(wf => wf.name.includes('07') || /google.*drive|drive.*google/i.test(wf.name));
  console.log('WF-07:', wf07 ? `[${wf07.id}] ${wf07.name}` : 'NOT FOUND');
  
  if (wf07) {
    const detail = await api(`/workflows/${wf07.id}`);
    if (detail.ok) {
      const driveNodes = (detail.data?.nodes || []).filter(n => /drive/i.test(n.type));
      console.log('Drive nodes in WF-07:', driveNodes.map(n => `"${n.name}" creds:${JSON.stringify(n.credentials)}`));
    }
  }
  
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod NOT FOUND. Requires creating Google Drive OAuth credential manually at ${N8N}/home/credentials/new. Use account peterpohankapersonal@gmail.com.`;
}
console.log('TODO-3:', RESULTS.todo3);

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const labelsNeeded = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

// Try navigating to Gmail with the iszapfalo account
// The profile has iam@peterpohanka.com but iszapfalo.ai@gmail.com is needed
// Let's check if the Gmail API can be accessed through n8n's OAuth connection

// First check: does Gmail account 4 have enough scope for label creation?
if (gmailCred) {
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  const credText = await page.locator('body').textContent().catch(() => '');
  const emailMatch = credText.match(/iszapfalo|gmail\.com|@[\w.]+\.com/i);
  console.log('Account in Gmail credential:', emailMatch?.[0] || 'not found');
}

// Try Gmail with account chooser for iszapfalo.ai@gmail.com
await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl.slice(0, 100));
await page.screenshot({ path: 'tasks/screenshots/t2_gmail_attempt.png' });

// Check accounts available  
const allAccountLinks = await page.locator('[data-email], [href*="accounts.google.com/AccountChooser"]').allTextContents().catch(() => []);
console.log('Gmail accounts in chooser:', allAccountLinks.slice(0, 10));

if (gmailUrl.includes('mail.google.com/mail')) {
  console.log('✅ Gmail loaded with account!');
  const emailEl = page.locator('[class*="account-name"], [data-email]').first();
  const email = await emailEl.getAttribute('data-email').catch(() => null) || 
                await emailEl.textContent().catch(() => null);
  console.log('Gmail account:', email);
  
  // Check existing labels via Gmail API
  const existingLabels = await page.evaluate(async () => {
    const r = await fetch('/gmail/v1/users/me/labels', { credentials: 'include' });
    if (!r.ok) return { error: r.status };
    return r.json();
  });
  console.log('Existing labels:', JSON.stringify(existingLabels)?.slice(0, 200));
  
  // Create labels via Gmail API
  const createResults = [];
  for (const labelName of labelsNeeded) {
    const r = await page.evaluate(async (name) => {
      const resp = await fetch('/gmail/v1/users/me/labels', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      });
      return { status: resp.status, body: await resp.text() };
    }, labelName);
    
    console.log(`  Label "${labelName}":`, r.status, r.body.slice(0, 100));
    if (r.status === 200 || r.status === 201) createResults.push(labelName);
    else if (r.status === 409) { 
      createResults.push(labelName + '(already exists)');
    }
  }
  
  RESULTS.todo2 = createResults.length > 0 
    ? `✅ Labels: ${createResults.join(', ')}`
    : `❌ Gmail API not accessible from this page context`;
    
} else {
  // Try Gmail with iszapfalo.ai@gmail.com via account switcher URL
  const gmailIszap = 'https://mail.google.com/mail/u/1/'; // Try user index 1
  await page.goto(gmailIszap, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const url2 = page.url();
  console.log('Gmail u/1 URL:', url2.slice(0, 100));
  
  if (url2.includes('mail.google.com/mail')) {
    const email2 = await page.locator('[data-email]').first().getAttribute('data-email').catch(() => 'unknown');
    console.log('Gmail u/1 account:', email2);
    
    if (email2?.includes('iszapfalo')) {
      const createResults2 = [];
      for (const labelName of labelsNeeded) {
        const r = await page.evaluate(async (name) => {
          const resp = await fetch('/gmail/v1/users/me/labels', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
          return { status: resp.status };
        }, labelName);
        if (r.status < 300) createResults2.push(labelName);
      }
      RESULTS.todo2 = `✅ Labels created: ${createResults2.join(', ')} (iszapfalo account)`;
    } else {
      RESULTS.todo2 = `⚠️ Gmail loaded as ${email2} (not iszapfalo). Labels need creation in iszapfalo.ai@gmail.com`;
    }
  } else {
    RESULTS.todo2 = `⚠️ Gmail not signed in with iszapfalo.ai@gmail.com. Must manually create labels: ${labelsNeeded.join(', ')} at https://mail.google.com/#settings/labels`;
  }
}
console.log('TODO-2:', RESULTS.todo2);

// ════════════════════════════════════════════════════════════════
// Final Summary
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [key, val] of Object.entries(RESULTS)) {
  console.log(`\n${key.toUpperCase()}: ${val}`);
}

await writeFile('tasks/final_results.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  results: RESULTS,
  workflows: allWorkflows.map(w => ({ id: w.id, name: w.name, active: w.active, archived: w.isArchived })),
  credentials: allCreds.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: allWebhookPaths
}, null, 2));

console.log('\n✅ Saved to tasks/final_results.json');
await ctx.close();
