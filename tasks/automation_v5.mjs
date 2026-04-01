/**
 * n8n FINAL Automation - ctx.request without explicit Cookie header
 * BrowserContext.request inherits cookies from the browser session
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run4';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '⏳', todo2: '⏳', todo3: '⏳', todo4: '⏳', todo5: '⏳' };

console.log('=== n8n FINAL Automation ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1440, height: 900 },
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// Load n8n dashboard (establishes auth session)
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}
console.log('✅ Session valid!');

// API helper: ctx.request shares cookies with browser context
// DO NOT set Cookie header - let the browser context pass it automatically
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'accept': 'application/json', 'content-type': 'application/json' },
    ignoreHTTPSErrors: true
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

// Test API connectivity
const settingsTest = await api('/settings');
const meTest = await api('/me');
const wfTest = await api('/workflows?limit=5');
console.log('API tests - settings:', settingsTest.status, '| /me:', meTest.status, '| /workflows:', wfTest.status);

if (!wfTest.ok && meTest.status === 401) {
  // Try triggering API calls via page navigation - the browser will auth them
  console.log('API auth failing. Trying page-based API interception...');
  
  // Use Playwright to intercept the exact network request and grab its storage cookies
  let capturedReqHeaders = null;
  
  const interceptPromise = new Promise(resolve => {
    ctx.on('request', req => {
      if (req.url().includes('/rest/workflows') && !capturedReqHeaders) {
        capturedReqHeaders = req.headers();
        resolve(capturedReqHeaders);
      }
    });
    setTimeout(resolve, 10000, null);
  });
  
  // Reload the page to trigger new API requests
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  capturedReqHeaders = await interceptPromise;
  
  if (capturedReqHeaders) {
    console.log('Captured request headers. Cookie:', capturedReqHeaders.cookie?.slice(0, 60) + '...');
    
    // Now use these EXACT headers for API calls
    async function apiWithHeaders(path, method = 'GET', body = null) {
      const opts = {
        method,
        headers: {
          ...capturedReqHeaders,
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
    
    // Replace api function
    const apiV2 = apiWithHeaders;
    
    const wfTest2 = await apiV2('/workflows?limit=5');
    console.log('API test with intercepted headers - /workflows:', wfTest2.status);
    
    if (wfTest2.ok) {
      console.log('✅ Intercepted headers work!');
      
      // Get ALL workflows
      const wfResp = await apiV2('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
      const allWorkflows = wfResp.data?.data || [];
      console.log(`Got ${allWorkflows.length} workflows`);
      for (const wf of allWorkflows) console.log(`  [${wf.id}] "${wf.name}" active:${wf.active} archived:${wf.isArchived}`);
      
      // Get credentials
      const credResp = await apiV2('/credentials?limit=100');
      const allCreds = credResp.data?.data || credResp.data || [];
      console.log(`Got ${allCreds.length} credentials`);
      for (const c of allCreds) console.log(`  [${c.id}] "${c.name}" type:${c.type}`);
      
      await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
      await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));
      
      // TODO-5: Webhooks
      const nonArchived = allWorkflows.filter(w => !w.isArchived);
      const webhookMap = {};
      for (const wf of nonArchived) {
        const d = await apiV2(`/workflows/${wf.id}`);
        if (!d.ok) continue;
        for (const node of (d.data?.nodes || [])) {
          if (node.type === 'n8n-nodes-base.webhook') {
            const p = node.parameters?.path;
            if (p) {
              if (!webhookMap[p]) webhookMap[p] = [];
              webhookMap[p].push(wf.name);
            }
          }
        }
      }
      console.log('Webhook paths:', JSON.stringify(webhookMap));
      const conflicts = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
      RESULTS.todo5 = conflicts.length > 0 
        ? `⚠️ Conflicts: ${conflicts.map(([p,v])=>`"${p}":${v.join(',')}`).join('; ')}`
        : `✅ No conflicts. Paths: ${Object.entries(webhookMap).map(([p,v])=>`"${p}"(${v[0]})`).join(', ') || 'none'}`;
      
      // TODO-4: Airtable
      const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
      const oldAirtable = allCreds.filter(c => /airtable/i.test(c.name) && c.id !== airtablePAT?.id);
      let todo4Count = 0;
      
      if (airtablePAT) {
        for (const wf of nonArchived) {
          const d = await apiV2(`/workflows/${wf.id}`);
          if (!d.ok) continue;
          let modified = false;
          for (const node of (d.data?.nodes || [])) {
            if (!node.credentials) continue;
            for (const [ct, ci] of Object.entries(node.credentials)) {
              if (/airtable/i.test(ct) && ci.id !== airtablePAT.id && oldAirtable.some(c => c.id === ci.id)) {
                console.log(`Update "${wf.name}" node "${node.name}": ${ci.name} → ${airtablePAT.name}`);
                node.credentials[ct] = { id: airtablePAT.id, name: airtablePAT.name };
                modified = true;
              }
            }
          }
          if (modified) {
            const r = await apiV2(`/workflows/${wf.id}`, 'PUT', d.data);
            if (r.ok) { todo4Count++; console.log(`  ✅ Updated ${wf.name}`); }
            else console.log(`  ❌ Failed: ${r.status}`, JSON.stringify(r.data).slice(0, 100));
          }
        }
        RESULTS.todo4 = `✅ Updated Airtable creds in ${todo4Count} workflows (ISZ_Airtable_PAT_v3 [${airtablePAT.id}])`;
      } else {
        RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found. Creds: ${allCreds.filter(c=>/airtable/i.test(c.name)).map(c=>c.name).join(', ')}`;
      }
      
      // TODO-1: Gmail
      const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
      if (gmailCred) {
        await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred.png' });
        const pageText = await page.locator('body').textContent().catch(() => '');
        const hasReconnect = /reconnect/i.test(pageText);
        const hasConnected = /connected/i.test(pageText);
        RESULTS.todo1 = `Gmail account 4 [${gmailCred.id}] — reconnect needed: ${hasReconnect}, connected: ${hasConnected}. See screenshot.`;
      } else {
        RESULTS.todo1 = '❌ Gmail account 4 not in credentials list';
      }
      
      // TODO-3: Drive
      const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
      if (driveCred) {
        RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists`;
      } else {
        const driveType = allCreds.filter(c => /drive/i.test(c.type + c.name));
        RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod not found. Drive-type creds: ${driveType.map(c=>c.name).join(', ')||'none'}. Create manually.`;
      }
    }
  }
}

// If API worked without intercept, process results
if (wfTest.ok) {
  console.log('\n✅ API works with ctx.request (no explicit cookie)!');
  
  const wfResp = await api('/workflows?includeScopes=true&filter=%7B%7D&skip=0&take=200');
  const allWorkflows = wfResp.data?.data || [];
  const credResp = await api('/credentials?limit=100');
  const allCreds = credResp.data?.data || credResp.data || [];
  
  console.log(`${allWorkflows.length} workflows, ${allCreds.length} credentials`);
  for (const wf of allWorkflows) console.log(`  WF [${wf.id}] "${wf.name}" active:${wf.active} archived:${wf.isArchived}`);
  for (const c of allCreds) console.log(`  CRED [${c.id}] "${c.name}" ${c.type}`);
  
  await writeFile('tasks/all_workflows.json', JSON.stringify(allWorkflows, null, 2));
  await writeFile('tasks/all_credentials.json', JSON.stringify(allCreds, null, 2));
  
  const nonArchived = allWorkflows.filter(w => !w.isArchived);
  
  // TODO-5
  const webhookMap = {};
  for (const wf of nonArchived) {
    const d = await api(`/workflows/${wf.id}`);
    if (!d.ok) continue;
    for (const node of (d.data?.nodes || [])) {
      if (node.type === 'n8n-nodes-base.webhook') {
        const p = node.parameters?.path;
        if (p) { if (!webhookMap[p]) webhookMap[p] = []; webhookMap[p].push(wf.name); }
      }
    }
  }
  const conflicts5 = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
  RESULTS.todo5 = conflicts5.length > 0 
    ? `⚠️ Conflicts: ${conflicts5.map(([p,v])=>`"${p}":${v.join(',')}`).join('; ')}`
    : `✅ No conflicts. Paths: ${Object.entries(webhookMap).map(([p,v])=>`"${p}"(${v[0]})`).join(', ')||'none'}`;
  
  // TODO-4
  const airtablePAT = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
  const oldAirtable = allCreds.filter(c => /airtable/i.test(c.name) && c.id !== airtablePAT?.id);
  let todo4Count = 0;
  if (airtablePAT) {
    for (const wf of nonArchived) {
      const d = await api(`/workflows/${wf.id}`);
      if (!d.ok) continue;
      let modified = false;
      for (const node of (d.data?.nodes || [])) {
        if (!node.credentials) continue;
        for (const [ct, ci] of Object.entries(node.credentials)) {
          if (/airtable/i.test(ct) && ci.id !== airtablePAT.id && oldAirtable.some(c => c.id === ci.id)) {
            console.log(`Update "${wf.name}" node "${node.name}": ${ci.name} → ${airtablePAT.name}`);
            node.credentials[ct] = { id: airtablePAT.id, name: airtablePAT.name };
            modified = true;
          }
        }
      }
      if (modified) {
        const r = await api(`/workflows/${wf.id}`, 'PUT', d.data);
        if (r.ok) { todo4Count++; console.log(`  ✅ ${wf.name}`); }
        else console.log(`  ❌ ${r.status}`, JSON.stringify(r.data).slice(0, 100));
      }
    }
    RESULTS.todo4 = `✅ Updated ${todo4Count} workflows with ISZ_Airtable_PAT_v3 [${airtablePAT.id}]`;
  } else {
    RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found`;
  }
  
  // TODO-1
  const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
  if (gmailCred) {
    await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred.png' });
    const pageText = await page.locator('body').textContent().catch(() => '');
    RESULTS.todo1 = `Gmail account 4 [${gmailCred.id}] — status: ${/connected/i.test(pageText) ? 'connected' : 'needs check'}. See screenshot.`;
  } else {
    RESULTS.todo1 = '❌ Gmail account 4 not found';
  }
  
  // TODO-3
  const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
  RESULTS.todo3 = driveCred 
    ? `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists`
    : `❌ Not found. All creds: ${allCreds.filter(c=>/drive/i.test(c.name+c.type)).map(c=>c.name).join(',')||'none'}`;
}

// TODO-2: Gmail labels (separate from n8n)
console.log('\n=== TODO-2: Gmail labels ===');
await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);
const gmailUrl = page.url();
console.log('Gmail URL:', gmailUrl.slice(0, 100));
await page.screenshot({ path: 'tasks/screenshots/t2_gmail.png' });

if (gmailUrl.includes('mail.google.com/mail')) {
  const emailEl = await page.locator('[data-email]').first().getAttribute('data-email').catch(() => null);
  console.log('Gmail account:', emailEl);
  
  const labelsNeeded = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];
  const labelResults = [];
  
  for (const labelName of labelsNeeded) {
    const r = await page.evaluate(async (name) => {
      try {
        const resp = await fetch('/gmail/v1/users/me/labels', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        });
        return { status: resp.status, text: await resp.text() };
      } catch(e) { return { error: e.message }; }
    }, labelName);
    
    console.log(`  Label "${labelName}": status ${r.status}, body: ${r.text?.slice(0,80) || r.error}`);
    if (r.status < 300) labelResults.push(`✅${labelName}`);
    else if (r.status === 409) labelResults.push(`↩️${labelName}(exists)`);
    else labelResults.push(`❌${labelName}(${r.status})`);
  }
  
  RESULTS.todo2 = `Gmail (${emailEl}): ${labelResults.join(', ')}`;
} else {
  RESULTS.todo2 = `⚠️ Gmail not loaded (URL: ${gmailUrl.slice(0,60)}). Labels need manual creation for iszapfalo.ai@gmail.com`;
}

console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [k, v] of Object.entries(RESULTS)) console.log(`\n${k.toUpperCase()}: ${v}`);

await writeFile('tasks/final_results.json', JSON.stringify({
  timestamp: new Date().toISOString(), results: RESULTS
}, null, 2));

await ctx.close();
