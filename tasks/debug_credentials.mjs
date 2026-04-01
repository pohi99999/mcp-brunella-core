/**
 * n8n Debug: Check actual credential IDs in workflow nodes + TODO-4 verification
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run8';
const N8N = 'https://iszapfalo.app.n8n.cloud';

console.log('=== n8n Debug v8 ===', new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  viewport: { width: 1440, height: 900 },
});

let n8nHeaders = {};
let capturedWorkflows = null;

ctx.on('request', (req) => {
  if (!req.url().startsWith(N8N + '/rest/')) return;
  const h = req.headers();
  if (h['browser-id'] && !n8nHeaders['browser-id']) n8nHeaders = { ...h };
});

ctx.on('response', async (res) => {
  if (!res.url().startsWith(N8N + '/rest/workflows')) return;
  if (res.status() !== 200 || capturedWorkflows) return;
  try {
    const d = JSON.parse(await res.text());
    if ((d.data||[]).length >= 10) { capturedWorkflows = d; console.log(`📥 Workflows: ${d.data.length}`); }
  } catch {}
});

const page = await ctx.newPage();
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);

if (page.url().includes('/signin')) { console.log('❌ Expired'); await ctx.close(); process.exit(1); }
console.log('✅ Logged in');

async function api(path, method = 'GET', body = null) {
  const result = await page.evaluate(async ({ url, method, body, browserId, pushRef }) => {
    const h = { 'accept': 'application/json', 'content-type': 'application/json' };
    if (browserId) h['browser-id'] = browserId;
    if (pushRef) h['push-ref'] = pushRef;
    const opts = { method, credentials: 'include', headers: h };
    if (body) opts.body = JSON.stringify(body);
    try { const r = await fetch(url, opts); return { ok: r.ok, status: r.status, text: await r.text() }; }
    catch(e) { return { ok: false, status: -1, text: e.message }; }
  }, { url: `${N8N}/rest${path}`, method, body, browserId: n8nHeaders['browser-id'], pushRef: n8nHeaders['push-ref'] });
  try { return { ok: result.ok, status: result.status, data: JSON.parse(result.text) }; }
  catch { return { ok: result.ok, status: result.status, data: result.text }; }
}

await page.goto(`${N8N}/home/workflows`, { waitUntil: 'domcontentloaded' });

const allWorkflows = capturedWorkflows?.data || [];
console.log(`\nWorkflows: ${allWorkflows.length}`);

// TARGET credential IDs
const TARGET_ID = 'xzTM1nLU5Iaomt9x'; // ISZ_Airtable_PAT_v3
const OLD_IDS = ['C9VdIislEHaqxREL', 'OLUAFTjZT0aSEj6H'];

console.log('\n=== AUDIT: All credential usages in workflows ===');
const auditResults = {};
let workflowsNeedingUpdate = [];

for (const wf of allWorkflows) {
  const d = await api(`/workflows/${wf.id}`);
  if (!d.ok) { console.log(`❌ ${wf.name}: ${d.status}`); continue; }
  
  const nodes = d.data?.nodes || [];
  const credNodes = nodes.filter(n => n.credentials && Object.keys(n.credentials).length > 0);
  
  if (credNodes.length > 0) {
    console.log(`\n  WF: "${wf.name}" [${wf.id}]`);
    auditResults[wf.id] = { name: wf.name, nodes: [] };
    let needsUpdate = false;
    
    for (const node of credNodes) {
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        const isOld = OLD_IDS.includes(credInfo?.id);
        const isTarget = credInfo?.id === TARGET_ID;
        const flag = isOld ? '🔴OLD' : isTarget ? '✅PAT' : '⚪';
        console.log(`    ${flag} Node "${node.name}" [${node.type}]: ${credType} → [${credInfo?.id}] "${credInfo?.name}"`);
        auditResults[wf.id].nodes.push({ node: node.name, type: credType, credId: credInfo?.id, credName: credInfo?.name, isOld, isTarget });
        if (isOld) needsUpdate = true;
      }
    }
    
    if (needsUpdate) workflowsNeedingUpdate.push({ wf, data: d.data });
  }
  // Also check WF-01 trigger type
  if (wf.name.includes('01 - ISZ')) {
    const triggerNodes = nodes.filter(n => n.name.toLowerCase().includes('trigger') || n.type.includes('Trigger'));
    console.log(`\n  WF-01 trigger nodes: ${triggerNodes.map(n => `${n.name} (${n.type})`).join(', ')||'none'}`);
  }
}

console.log(`\n=== UPDATE NEEDED: ${workflowsNeedingUpdate.length} workflows ===`);

// Perform updates
let updateCount = 0;
for (const { wf, data: wfData } of workflowsNeedingUpdate) {
  console.log(`\nUpdating: "${wf.name}"`);
  for (const node of wfData.nodes || []) {
    if (!node.credentials) continue;
    for (const [ct, ci] of Object.entries(node.credentials)) {
      if (OLD_IDS.includes(ci?.id)) {
        console.log(`  Replacing [${ci.id}] "${ci.name}" → ISZ_Airtable_PAT_v3`);
        node.credentials[ct] = { id: TARGET_ID, name: 'ISZ_Airtable_PAT_v3' };
      }
    }
  }
  const r = await api(`/workflows/${wf.id}`, 'PUT', wfData);
  if (r.ok) { console.log(`  ✅ Updated!`); updateCount++; }
  else console.log(`  ❌ Failed: ${r.status}`, JSON.stringify(r.data).slice(0, 200));
}

console.log(`\n=== SUMMARY ===`);
console.log(`Updated: ${updateCount}/${workflowsNeedingUpdate.length} workflows`);
console.log(`Total workflows with credentials checked: ${Object.keys(auditResults).length}`);

await writeFile('tasks/audit_credentials.json', JSON.stringify(auditResults, null, 2));
console.log('Saved audit to tasks/audit_credentials.json');

await ctx.close();
