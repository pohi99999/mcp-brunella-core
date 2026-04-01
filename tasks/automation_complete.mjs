/**
 * SINGLE COMPREHENSIVE PASS - All 5 TODOs
 * Strategy: Intercept ACTUAL n8n frontend API calls to capture auth headers,
 * then use those exact headers for our own calls.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run2';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '', todo2: '', todo3: '', todo4: '', todo5: '' };

console.log('=== n8n Complete Automation (Single Pass) ===');
console.log(new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

// Intercept ALL /rest/ calls to capture exact working headers
const interceptedCalls = {};
ctx.on('request', req => {
  if (req.url().includes(N8N + '/rest/')) {
    const path = req.url().replace(N8N + '/rest', '');
    interceptedCalls[path] = {
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
    };
  }
});

// Also capture responses for status codes
const interceptedResponses = {};
ctx.on('response', async res => {
  if (res.url().includes(N8N + '/rest/')) {
    const path = res.url().replace(N8N + '/rest', '');
    try {
      const text = await res.text().catch(() => '');
      interceptedResponses[path] = { status: res.status(), text: text.slice(0, 2000) };
    } catch(e) {}
  }
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// ── Step 1: Load n8n, let it make its own API calls ──────────────
console.log('\n[1] Loading n8n and waiting for API calls...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(8000); // Wait for Vue app + all API calls

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}

console.log('✅ Session valid!', page.url());
await page.screenshot({ path: 'tasks/screenshots/00_loaded.png' });

// Show intercepted calls
console.log(`\nIntercepted ${Object.keys(interceptedCalls).length} REST calls:`);
for (const [path, call] of Object.entries(interceptedCalls)) {
  const status = interceptedResponses[path]?.status || '?';
  const authHdrs = Object.entries(call.headers)
    .filter(([k]) => ['cookie','authorization','x-n8n','csrf','x-auth'].some(h => k.includes(h)))
    .map(([k,v]) => `${k}=${v.slice(0,60)}`);
  console.log(`  ${call.method} ${path} → ${status}${authHdrs.length ? '\n    Auth: '+authHdrs.join(', ') : ''}`);
}

// Find a working authenticated call
const workflowsCall = interceptedCalls['/workflows?includeScopes=true&onlyActive=false'] 
  || interceptedCalls['/workflows'] 
  || Object.entries(interceptedCalls).find(([p]) => p.startsWith('/workflows'))?.[1];

const workflowsResponse = interceptedResponses[Object.keys(interceptedResponses).find(p => p.startsWith('/workflows'))] 

console.log('\nWorkflows call found:', workflowsCall ? workflowsCall.url.replace(N8N,'') : 'NO');
if (workflowsResponse) {
  console.log('Workflows response status:', workflowsResponse.status);
  console.log('Workflows response:', workflowsResponse.text.slice(0, 300));
}

// ── Step 2: Extract working headers from captured calls ──────────
let workingHeaders = null;
let allWorkflows = [];
let allCreds = [];

// Parse the workflows from the intercepted response
if (workflowsResponse && workflowsResponse.status === 200) {
  try {
    const data = JSON.parse(workflowsResponse.text);
    allWorkflows = data.data || data || [];
    console.log(`\n✅ Got ${allWorkflows.length} workflows from intercept!`);
    for (const wf of allWorkflows) {
      console.log(`  [${wf.id}] "${wf.name}" active:${wf.active}`);
    }
  } catch(e) {
    console.log('Failed to parse workflows:', e.message);
  }
}

// Get credentials from intercepted calls
const credsPath = Object.keys(interceptedResponses).find(p => p.includes('/credentials'));
if (credsPath && interceptedResponses[credsPath].status === 200) {
  try {
    const data = JSON.parse(interceptedResponses[credsPath].text);
    allCreds = data.data || data || [];
    console.log(`\n✅ Got ${allCreds.length} credentials from intercept!`);
    for (const c of allCreds) {
      console.log(`  [${c.id}] "${c.name}" ${c.type}`);
    }
  } catch(e) {}
}

// If we have a working call, extract headers for further API calls
if (workflowsCall) {
  workingHeaders = workflowsCall.headers;
}

// If credentials weren't captured, navigate to credentials page
if (allCreds.length === 0) {
  console.log('\nNavigating to credentials page to capture API call...');
  await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  const credsPath2 = Object.keys(interceptedResponses).find(p => p.includes('/credentials'));
  if (credsPath2 && interceptedResponses[credsPath2].status === 200) {
    try {
      const data = JSON.parse(interceptedResponses[credsPath2].text);
      allCreds = data.data || data || [];
      console.log(`Got ${allCreds.length} credentials`);
    } catch(e) {}
  }
  await page.screenshot({ path: 'tasks/screenshots/01_credentials.png' });
}

// ── Helper: make API call with captured working headers ──────────
async function apiCall(path, method = 'GET', body = null) {
  if (!workingHeaders) {
    // Fallback to ctx.cookies()
    const cookies = await ctx.cookies();
    const n8nCookie = cookies.find(c => c.name === 'n8n-auth');
    if (n8nCookie) workingHeaders = { 'cookie': `n8n-auth=${n8nCookie.value}` };
  }
  
  const hdrs = {
    ...(workingHeaders || {}),
    'accept': 'application/json',
    'content-type': 'application/json',
  };
  
  try {
    const resp = await ctx.request.fetch(`${N8N}/rest${path}`, {
      method,
      headers: hdrs,
      ...(body ? { data: JSON.stringify(body) } : {}),
    });
    const text = await resp.text();
    try { return { ok: resp.status() < 400, status: resp.status(), data: JSON.parse(text) }; }
    catch { return { ok: resp.status() < 400, status: resp.status(), data: text }; }
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// If workflows not captured via intercept, try API directly
if (allWorkflows.length === 0) {
  const wfR = await apiCall('/workflows?limit=100');
  console.log('Direct API /workflows:', wfR.status);
  if (wfR.ok) {
    allWorkflows = wfR.data?.data || [];
    console.log(`Got ${allWorkflows.length} workflows via direct API`);
  }
}

if (allCreds.length === 0) {
  const credR = await apiCall('/credentials?limit=100');
  console.log('Direct API /credentials:', credR.status);
  if (credR.ok) {
    allCreds = credR.data?.data || [];
    console.log(`Got ${allCreds.length} credentials via direct API`);
  }
}

console.log(`\nSummary: ${allWorkflows.length} workflows, ${allCreds.length} credentials`);
await writeFile('tasks/n8n_workflows.json', JSON.stringify(allWorkflows, null, 2));
await writeFile('tasks/n8n_credentials.json', JSON.stringify(allCreds, null, 2));

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook path check
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Webhook path check ===');

const wf01 = allWorkflows.find(wf => /^01|hibafigyelés|hiba.*figyelés/i.test(wf.name));
const wf01candidates = allWorkflows.filter(wf => /01|hibafigyelés/i.test(wf.name));
console.log('WF-01 candidates:', wf01candidates.map(w => `[${w.id}] ${w.name}`));

const allWebhookPaths = {};
for (const wf of allWorkflows) {
  const detail = await apiCall(`/workflows/${wf.id}`);
  if (detail.ok && detail.data) {
    const wfData = detail.data;
    const nodes = wfData.nodes || [];
    for (const node of nodes) {
      if (node.type === 'n8n-nodes-base.webhook' || node.type?.includes('Webhook')) {
        const path = node.parameters?.path;
        const method = node.parameters?.httpMethod;
        if (path) {
          if (!allWebhookPaths[path]) allWebhookPaths[path] = [];
          allWebhookPaths[path].push({ wfId: wf.id, wfName: wf.name, method });
        }
      }
    }
  }
}

console.log('All webhook paths:', JSON.stringify(allWebhookPaths, null, 2));

const conflicts = Object.entries(allWebhookPaths).filter(([, uses]) => uses.length > 1);
if (conflicts.length > 0) {
  RESULTS.todo5 = `⚠️ Webhook path CONFLICTS: ${conflicts.map(([p, u]) => `"${p}" used by ${u.map(x=>x.wfName).join(', ')}`).join('; ')}`;
} else {
  const wf01webhook = wf01 && Object.entries(allWebhookPaths).find(([, uses]) => uses.some(u => u.wfId === wf01.id));
  if (wf01webhook) {
    RESULTS.todo5 = `✅ Webhook path "${wf01webhook[0]}" (WF-01) is unique`;
  } else {
    RESULTS.todo5 = `✅ No webhook conflicts found. All paths: ${Object.keys(allWebhookPaths).join(', ')}`;
  }
}
console.log('TODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Update Airtable credentials
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Update Airtable credentials ===');
const airtableCred = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
console.log('ISZ_Airtable_PAT_v3:', airtableCred ? `[${airtableCred.id}] type:${airtableCred.type}` : 'NOT FOUND');
console.log('All Airtable creds:', allCreds.filter(c => /airtable/i.test(c.name + c.type)).map(c => `[${c.id}] ${c.name}`));

const airtableTargets = [
  'Feladatok státuszállítás',
  'Airtable-Google Calendar',
  'Weekly Reminder',
  'Google Calendar Szinkron'
];

const matchedWFs = allWorkflows.filter(wf => 
  airtableTargets.some(t => wf.name.toLowerCase().includes(t.toLowerCase().slice(0, 15)))
);
console.log('Target workflows:', matchedWFs.map(w => `[${w.id}] ${w.name}`));

let updated = 0;
if (airtableCred) {
  for (const wf of matchedWFs) {
    const detail = await apiCall(`/workflows/${wf.id}`);
    if (!detail.ok) continue;
    
    const wfData = detail.data;
    const nodes = wfData.nodes || [];
    let modified = false;
    
    for (const node of nodes) {
      if (!node.credentials) continue;
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        if (/airtable/i.test(credType + (credInfo.name || ''))) {
          if (credInfo.id !== airtableCred.id) {
            console.log(`  [${wf.name}] Node "${node.name}": ${credInfo.name} → ${airtableCred.name}`);
            node.credentials[credType] = { id: airtableCred.id, name: airtableCred.name };
            modified = true;
          } else {
            console.log(`  [${wf.name}] Node "${node.name}": already correct ✓`);
          }
        }
      }
    }
    
    if (modified) {
      const putR = await apiCall(`/workflows/${wf.id}`, 'PUT', wfData);
      if (putR.ok) {
        console.log(`  ✅ Updated: ${wf.name}`);
        updated++;
      } else {
        console.log(`  ❌ Failed to update ${wf.name}: ${putR.status}`, JSON.stringify(putR.data).slice(0, 100));
      }
    }
  }
  RESULTS.todo4 = `Updated Airtable creds in ${updated}/${matchedWFs.length} workflows`;
} else {
  RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found. Available: ${allCreds.filter(c=>/airtable/i.test(c.name)).map(c=>c.name).join(', ')}`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail OAuth status check
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail OAuth ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
console.log('Gmail account 4:', gmailCred ? `[${gmailCred.id}]` : 'NOT FOUND');
console.log('All Gmail creds:', allCreds.filter(c => /gmail/i.test(c.name)).map(c => `[${c.id}] ${c.name}`));

if (gmailCred) {
  // Test the credential
  const testR = await apiCall(`/credentials/${gmailCred.id}/test`, 'POST', {});
  console.log('Credential test:', testR.status, JSON.stringify(testR.data).slice(0, 200));
  
  // Navigate to the credential UI
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_credential.png' });
  
  // Check for error/reconnect indicators
  const bodyText = await page.locator('body').textContent();
  const needsReconnect = /reconnect|error|expired|invalid|revoked/i.test(bodyText);
  const isConnected = /connected|valid|authorized/i.test(bodyText);
  
  console.log('Needs reconnect:', needsReconnect, '| Is connected:', isConnected);
  
  if (testR.ok && testR.data?.status === 'OK') {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] is valid and connected`;
  } else if (testR.status === 400 || testR.data?.message?.includes('token')) {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] needs token renewal. Navigate to ${N8N}/home/credentials/${gmailCred.id} to reconnect.`;
  } else {
    RESULTS.todo1 = `Gmail account 4 [${gmailCred.id}] test: ${JSON.stringify(testR.data).slice(0, 100)}`;
  }
} else {
  RESULTS.todo1 = `⚠️ Gmail account 4 not found in credentials`;
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive credential ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const driveCredAny = allCreds.find(c => /drive|google.drive/i.test(c.name + c.type));

if (driveCred) {
  console.log(`✅ ISZ_GoogleDrive_Prod found: [${driveCred.id}] type:${driveCred.type}`);
  
  // Find WF-07
  const wf07 = allWorkflows.find(wf => /^07|.*drive.*wf/i.test(wf.name));
  const wf07candidates = allWorkflows.filter(wf => wf.name.includes('07') || /drive/i.test(wf.name));
  console.log('WF-07 candidates:', wf07candidates.map(w => `[${w.id}] ${w.name}`));
  
  if (wf07candidates.length > 0) {
    for (const wf of wf07candidates) {
      const detail = await apiCall(`/workflows/${wf.id}`);
      if (detail.ok) {
        const driveNodes = (detail.data?.nodes || []).filter(n => /drive/i.test(n.type));
        let modified = false;
        for (const node of driveNodes) {
          if (!node.credentials) continue;
          for (const [ct, ci] of Object.entries(node.credentials)) {
            if (/drive/i.test(ct) && ci.id !== driveCred.id) {
              console.log(`  Node "${node.name}": ${ci.name} → ${driveCred.name}`);
              node.credentials[ct] = { id: driveCred.id, name: driveCred.name };
              modified = true;
            }
          }
        }
        if (modified) {
          const putR = await apiCall(`/workflows/${wf.id}`, 'PUT', detail.data);
          console.log(`  Update WF-07: ${putR.ok ? '✅' : '❌'} ${putR.status}`);
        }
      }
    }
    RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists. Checked WF-07.`;
  } else {
    RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists. No WF-07 found by name.`;
  }
} else {
  console.log('ISZ_GoogleDrive_Prod NOT found');
  if (driveCredAny) console.log('Found similar:', `[${driveCredAny.id}] ${driveCredAny.name}`);
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod not found. Closest: ${driveCredAny ? `[${driveCredAny.id}] ${driveCredAny.name}` : 'none'}. Needs manual OAuth creation.`;
}
console.log('TODO-3:', RESULTS.todo3);

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels (via Gmail UI)
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const labelsToCreate = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

await page.goto('https://mail.google.com', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl.slice(0, 80));
await page.screenshot({ path: 'tasks/screenshots/t2_gmail_start.png' });

// Check if this profile has Gmail session for iszapfalo.ai@gmail.com
const accounts = await page.locator('[data-email]').all();
const accountEmails = await Promise.all(accounts.map(a => a.getAttribute('data-email').catch(() => null)));
console.log('Gmail accounts available:', accountEmails.filter(Boolean));

if (gmailUrl.includes('mail.google.com')) {
  console.log('✅ Gmail loaded!');
  
  // Try Gmail API via page context (Gmail web app handles auth)
  const labelsResult = await page.evaluate(async (labels) => {
    const results = [];
    for (const label of labels) {
      try {
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          credentials: 'include',
          headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
          body: JSON.stringify({name: label, labelListVisibility: 'labelShow', messageListVisibility: 'show'})
        });
        results.push({label, status: r.status, ok: r.status < 400});
      } catch(e) {
        results.push({label, error: e.message});
      }
    }
    return results;
  }, labelsToCreate);
  
  console.log('Gmail API results:', labelsResult);
  
  const created = labelsResult.filter(r => r.ok);
  const failed = labelsResult.filter(r => !r.ok);
  
  if (created.length > 0) {
    RESULTS.todo2 = `✅ Created labels: ${created.map(r => r.label).join(', ')}`;
  } else {
    // Try UI approach
    console.log('API failed, trying UI...');
    await page.goto('https://mail.google.com/mail/u/0/#settings/labels', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/screenshots/t2_gmail_settings.png' });
    
    // Look for label creation option
    const pageText = await page.locator('body').textContent();
    const hasCreateOption = /create new label|new label/i.test(pageText);
    console.log('Has create label option:', hasCreateOption);
    
    if (hasCreateOption) {
      const createdLabels = [];
      for (const labelName of labelsToCreate) {
        // Find "Create new label" link/button
        const createEl = page.locator('a:has-text("Create new label"), button:has-text("Create new label"), span:has-text("Create new label")').first();
        if (await createEl.isVisible({ timeout: 3000 }).catch(() => false)) {
          await createEl.click();
          await page.waitForTimeout(1500);
          
          const labelInput = page.locator('[role="dialog"] input, input[name="newlabel"]').first();
          if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await labelInput.fill(labelName);
            const submitBtn = page.locator('[role="dialog"] button:has-text("Create"), [role="dialog"] input[value="Create"]').first();
            if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await submitBtn.click();
              await page.waitForTimeout(2000);
              createdLabels.push(labelName);
              console.log(`  ✅ Created: ${labelName}`);
            } else {
              await labelInput.press('Enter');
              await page.waitForTimeout(2000);
              createdLabels.push(labelName);
            }
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
      RESULTS.todo2 = createdLabels.length > 0 ? `✅ Created: ${createdLabels.join(', ')}` : '⚠️ Label creation UI not functioning';
    } else {
      RESULTS.todo2 = `⚠️ Gmail loaded (${gmailUrl.includes('mail.google.com/mail') ? 'inbox' : 'other'}) but label settings not accessible. API: ${JSON.stringify(failed.map(r=>r.label))}`;
    }
  }
} else if (accountEmails.some(e => e?.includes('iszapfalo'))) {
  RESULTS.todo2 = '⚠️ iszapfalo account found but Gmail not auto-loaded. Navigate manually.';
} else {
  // Try signing into Gmail with iszapfalo.ai@gmail.com
  console.log('Not in Gmail, trying to sign in...');
  RESULTS.todo2 = '⚠️ Gmail requires authentication with iszapfalo.ai@gmail.com. Manual intervention needed.';
}
console.log('TODO-2:', RESULTS.todo2);

// ════════════════════════════════════════════════════════════════
// Final Summary
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('FINAL RESULTS');
console.log('='.repeat(60));
for (const [key, val] of Object.entries(RESULTS)) {
  console.log(`\n${key.toUpperCase()}: ${val}`);
}

const summary = {
  timestamp: new Date().toISOString(),
  results: RESULTS,
  workflows: allWorkflows.map(w => ({ id: w.id, name: w.name, active: w.active })),
  credentials: allCreds.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: allWebhookPaths || {}
};

await writeFile('tasks/final_results.json', JSON.stringify(summary, null, 2));
console.log('\n✅ Results saved to tasks/final_results.json');

await ctx.close();
