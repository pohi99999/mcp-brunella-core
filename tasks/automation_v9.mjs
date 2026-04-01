/**
 * n8n Final Automation v2 - Correct API path (d.data.data.nodes)
 * Fixed: single workflow response wraps in extra {data: {...}} envelope
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run10';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = { todo1: '⏳', todo2: '⏳', todo3: '⏳', todo4: '⏳', todo5: '⏳' };

console.log('=== n8n Final Automation v2 ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  viewport: { width: 1440, height: 900 },
});

let n8nHeaders = {};
let capturedWF = null, capturedCred = null;

ctx.on('request', r => {
  if (r.url().startsWith(N8N + '/rest/') && r.headers()['browser-id'] && !n8nHeaders['browser-id'])
    n8nHeaders = r.headers();
});
ctx.on('response', async r => {
  const url = r.url();
  if (!url.startsWith(N8N + '/rest/') || r.status() !== 200) return;
  try {
    if (url.includes('/rest/workflows') && !capturedWF) {
      const d = JSON.parse(await r.text());
      if ((d.data||[]).length >= 10) { capturedWF = d; console.log(`📥 WF: ${d.data.length}`); }
    }
    if (url.includes('/rest/credentials') && !capturedCred) {
      capturedCred = JSON.parse(await r.text());
      console.log(`📥 Creds: ${(capturedCred.data||[]).length}`);
    }
  } catch {}
});

const page = await ctx.newPage();
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);
if (page.url().includes('/signin')) { console.log('❌ Expired'); await ctx.close(); process.exit(1); }
console.log('✅ Logged in');

await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(4000);
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'domcontentloaded' });

async function api(path, method = 'GET', body = null) {
  const r = await page.evaluate(async ({url, method, body, bid, pr}) => {
    const h = {'accept':'application/json','content-type':'application/json'};
    if (bid) h['browser-id'] = bid;
    if (pr) h['push-ref'] = pr;
    const o = {method, credentials:'include', headers:h};
    if (body) o.body = JSON.stringify(body);
    try { const res = await fetch(url, o); return {ok:res.ok, status:res.status, text:await res.text()}; }
    catch(e) { return {ok:false, status:-1, text:e.message}; }
  }, {url:`${N8N}/rest${path}`, method, body, bid:n8nHeaders['browser-id'], pr:n8nHeaders['push-ref']});
  try { return {ok:r.ok, status:r.status, data:JSON.parse(r.text)}; }
  catch { return {ok:r.ok, status:r.status, data:r.text}; }
}

// Get workflow object from API response (handles double-wrapping)
function getWF(apiResult) {
  const d = apiResult.data;
  // /workflows/:id returns { data: { id, name, nodes, ... } }
  if (d?.data && Array.isArray(d.data.nodes)) return d.data;
  if (Array.isArray(d?.nodes)) return d;
  // Maybe it's the list endpoint format
  return d?.data || d || {};
}

// Load data
let allWF = capturedWF?.data || [];
let allCred = capturedCred?.data || [];
if (allWF.length === 0) { const r = await api('/workflows?skip=0&take=200'); allWF = r.data?.data || []; }
if (allCred.length === 0) { const r = await api('/credentials?limit=100'); allCred = r.data?.data || []; }
console.log(`\nLoaded: ${allWF.length} workflows, ${allCred.length} credentials`);
for (const w of allWF) console.log(`  WF[${w.id}] "${w.name}"`);
for (const c of allCred) console.log(`  CR[${c.id}] "${c.name}" (${c.type})`);

// Debug: check raw single workflow response
const dbg = await api(`/workflows/${allWF[0]?.id}`);
console.log(`\nSingle WF raw: keys=${Object.keys(dbg.data||{})}, data.keys=${Object.keys(dbg.data?.data||{}||{}).join(',')}`);
const dbgWF = getWF(dbg);
console.log(`getWF nodes: ${dbgWF.nodes?.length}, first:${dbgWF.nodes?.[0]?.name}(${dbgWF.nodes?.[0]?.type})`);

const nonArchived = allWF.filter(w => !w.isArchived);
await writeFile('tasks/all_workflows.json', JSON.stringify(allWF, null, 2));
await writeFile('tasks/all_credentials.json', JSON.stringify(allCred, null, 2));

// ════════════════════════════════════════════════════════════════
// Collect all nodes for audit
// ════════════════════════════════════════════════════════════════
console.log('\n=== Collecting all nodes ===');
const webhookMap = {};
const allNodes = [];
let fetchOK = 0;

for (const wf of nonArchived) {
  const d = await api(`/workflows/${wf.id}`);
  if (!d.ok) { console.log(`  ❌ ${wf.name}: ${d.status}`); continue; }
  fetchOK++;
  const wfData = getWF(d);
  for (const node of (wfData.nodes || [])) {
    allNodes.push({ wfId: wf.id, wfName: wf.name, type: node.type, name: node.name, creds: node.credentials });
    if (node.type === 'n8n-nodes-base.webhook') {
      const p = node.parameters?.path || 'unknown';
      if (!webhookMap[p]) webhookMap[p] = [];
      webhookMap[p].push({ workflow: wf.name, wfId: wf.id });
      console.log(`  WEBHOOK: "${p}" in "${wf.name}"`);
    }
    if (node.credentials) {
      for (const [ct, ci] of Object.entries(node.credentials)) {
        console.log(`  CRED: "${wf.name}"/"${node.name}" [${ct}]: [${ci?.id}] "${ci?.name}"`);
      }
    }
  }
}
console.log(`\nFetched ${fetchOK}/${nonArchived.length}. Total nodes: ${allNodes.length}, with creds: ${allNodes.filter(n=>n.creds).length}`);

// ════════════════════════════════════════════════════════════════
// TODO-5: Webhook check
// ════════════════════════════════════════════════════════════════
const conflicts = Object.entries(webhookMap).filter(([,v]) => v.length > 1);
RESULTS.todo5 = conflicts.length > 0
  ? `⚠️ PATH CONFLICTS: ${conflicts.map(([p,v]) => `"${p}": ${v.map(x=>x.workflow).join(' & ')}`).join('; ')}`
  : `✅ No webhook conflicts. ${Object.keys(webhookMap).length} webhook(s): ${Object.entries(webhookMap).map(([p,v])=>`"${p}"→${v[0].workflow}`).join(',')||'none found in active workflows'}`;
console.log('\nTODO-5:', RESULTS.todo5);

// ════════════════════════════════════════════════════════════════
// TODO-4: Airtable
// ════════════════════════════════════════════════════════════════
const airtablePAT = allCred.find(c => c.name === 'ISZ_Airtable_PAT_v3');
const oldIds = allCred.filter(c => /airtable/i.test(c.type) && c.id !== airtablePAT?.id).map(c => c.id);
console.log('\n=== TODO-4: Airtable ===');
console.log('Target:', airtablePAT ? `[${airtablePAT.id}]` : 'NOT FOUND');
console.log('Old IDs:', oldIds);

const airtableNodes = allNodes.filter(n => n.creds && Object.keys(n.creds).some(ct => /airtable/i.test(ct)));
console.log('Airtable credential nodes:', airtableNodes.map(n => `${n.wfName}/${n.name}: ${JSON.stringify(n.creds)}`).join('\n  '));

let t4Updated = 0, t4Log = [];
if (airtablePAT) {
  for (const wf of nonArchived) {
    const d = await api(`/workflows/${wf.id}`);
    if (!d.ok) continue;
    const wfData = getWF(d);
    let modified = false;
    for (const node of (wfData.nodes || [])) {
      if (!node.credentials) continue;
      for (const [ct, ci] of Object.entries(node.credentials)) {
        if (/airtable/i.test(ct) && ci && oldIds.includes(ci.id)) {
          console.log(`  REPLACING "${wf.name}"/"${node.name}": [${ci.id}] → [${airtablePAT.id}]`);
          node.credentials[ct] = { id: airtablePAT.id, name: airtablePAT.name };
          modified = true;
          t4Log.push(`${wf.name}: ${node.name}`);
        }
      }
    }
    if (modified) {
      const r = await api(`/workflows/${wf.id}`, 'PUT', wfData);
      if (r.ok) { t4Updated++; console.log(`  ✅ Updated "${wf.name}"`); }
      else { console.log(`  ❌ ${r.status}:`, JSON.stringify(r.data).slice(0,150)); t4Log.push(`FAILED:${wf.name}`); }
    }
  }
  const allAlreadyNew = airtableNodes.every(n => Object.values(n.creds||{}).every(ci => !oldIds.includes(ci?.id)));
  RESULTS.todo4 = t4Log.length > 0
    ? `✅ Updated ${t4Updated} workflow(s): ${t4Log.join(', ')}. Target: ISZ_Airtable_PAT_v3 [${airtablePAT.id}]`
    : `✅ All workflows already using ISZ_Airtable_PAT_v3 [${airtablePAT.id}]${airtableNodes.length > 0 ? ` (${airtableNodes.length} Airtable nodes checked)` : ' (no Airtable credential nodes found)'}`;
} else {
  RESULTS.todo4 = `⚠️ ISZ_Airtable_PAT_v3 not found`;
}
console.log('TODO-4:', RESULTS.todo4);

// ════════════════════════════════════════════════════════════════
// TODO-1: Gmail
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail ===');
const gmailCred = allCred.find(c => c.name === 'Gmail account 4');
if (gmailCred) {
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tasks/screenshots/final2_t1.png' });
  const txt = await page.locator('body').textContent();
  const connected = /connection tested successfully|account connected/i.test(txt);
  const reconnectBtn = await page.locator('button').filter({ hasText: /reconnect/i }).count();
  RESULTS.todo1 = connected
    ? `✅ Gmail account 4 [${gmailCred.id}] — "Connection tested successfully" (OAuth valid)`
    : reconnectBtn > 0
      ? `⚠️ Gmail account 4 [${gmailCred.id}] NEEDS RECONNECT → ${N8N}/home/credentials/${gmailCred.id}`
      : `Gmail [${gmailCred.id}] — status unclear (no explicit connected/error message found)`;
} else {
  RESULTS.todo1 = '❌ Gmail account 4 not found in credentials';
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-3: Google Drive
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive ===');
const driveCred = allCred.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const wf07 = nonArchived.find(w => w.name.startsWith('07'));
if (!driveCred) {
  RESULTS.todo3 = `❌ ISZ_GoogleDrive_Prod NOT FOUND — create manually:\n  → ${N8N}/home/credentials/new\n  → Type: Google Drive OAuth2 API\n  → Name: ISZ_GoogleDrive_Prod\n  → Google account: peterpohankapersonal@gmail.com\n  → Then connect to WF-07: "${wf07?.name}" [${wf07?.id}]`;
} else {
  const driveNodes = allNodes.filter(n => n.wfId === wf07?.id && /drive/i.test(n.type));
  const unlinked = driveNodes.filter(n => !n.creds?.googleDriveOAuth2Api);
  if (unlinked.length > 0 && wf07) {
    const d = await api(`/workflows/${wf07.id}`);
    if (d.ok) {
      const wfData = getWF(d);
      let mod = false;
      for (const n of (wfData.nodes || [])) {
        if (/drive/i.test(n.type) && !n.credentials?.googleDriveOAuth2Api) {
          if (!n.credentials) n.credentials = {};
          n.credentials.googleDriveOAuth2Api = { id: driveCred.id, name: driveCred.name };
          mod = true;
        }
      }
      if (mod) {
        const r = await api(`/workflows/${wf07.id}`, 'PUT', wfData);
        RESULTS.todo3 = r.ok ? `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] connected to WF-07 "${wf07.name}"` : `⚠️ Drive cred exists but WF-07 update failed: ${r.status}`;
      } else {
        RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists and connected`;
      }
    }
  } else {
    RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod [${driveCred.id}] exists`;
  }
}
console.log('TODO-3:', RESULTS.todo3);

// ════════════════════════════════════════════════════════════════
// TODO-2: Gmail labels
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const LABELS = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];
let gmailLoaded = false;
for (const idx of [0, 1, 2]) {
  await page.goto(`https://mail.google.com/mail/u/${idx}/`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  if (page.url().includes('mail.google.com/mail')) { gmailLoaded = true; console.log(`  Gmail u/${idx} loaded`); break; }
  console.log(`  Gmail u/${idx} redirect: ${page.url().slice(0,60)}`);
}
await page.screenshot({ path: 'tasks/screenshots/final2_t2.png' });

if (gmailLoaded) {
  const labelResults = [];
  for (const name of LABELS) {
    const r = await page.evaluate(async n => {
      const resp = await fetch('/gmail/v1/users/me/labels', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:n, labelListVisibility:'labelShow', messageListVisibility:'show'})
      });
      return {status:resp.status, body:await resp.text()};
    }, name);
    console.log(`  "${name}": ${r.status}`);
    if (r.status < 300) labelResults.push(`✅${name}`);
    else if (r.status === 409) labelResults.push(`↩️${name}(exists)`);
    else labelResults.push(`❌${name}(${r.status})`);
  }
  RESULTS.todo2 = `Gmail labels: ${labelResults.join(', ')}`;
} else {
  RESULTS.todo2 = `⚠️ Gmail not accessible in browser profile.\n  MANUAL ACTION: Login to iszapfalo.ai@gmail.com and create 4 labels:\n  1. Surges  2. Ajanlatkeres  3. Kotras  4. Egyeb\n  URL: https://mail.google.com/#settings/labels`;
}
console.log('TODO-2:', RESULTS.todo2);

// Summary
console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));
for (const [k, v] of Object.entries(RESULTS)) console.log(`\n${k.toUpperCase()}: ${v}`);

await writeFile('tasks/final_results.json', JSON.stringify({
  timestamp: new Date().toISOString(), results: RESULTS,
  workflows: allWF.map(w => ({ id: w.id, name: w.name })),
  credentials: allCred.map(c => ({ id: c.id, name: c.name, type: c.type })),
  webhookPaths: webhookMap,
  nodeAudit: allNodes.map(n => ({ wf: n.wfName, node: n.name, type: n.type, creds: n.creds }))
}, null, 2));
console.log('\n✅ Done. See tasks/final_results.json');
await ctx.close();
