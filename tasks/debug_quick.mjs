/**
 * n8n Quick Debug - dump raw workflow node structure
 */
import { chromium } from 'playwright';

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-run9';
const N8N = 'https://iszapfalo.app.n8n.cloud';

console.log('=== Quick Debug ===');
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true, args: ['--no-sandbox'],
  viewport: { width: 1440, height: 900 },
});

let n8nHeaders = {};
let capturedWF = null;

ctx.on('request', r => {
  if (r.url().startsWith(N8N + '/rest/') && r.headers()['browser-id'] && !n8nHeaders['browser-id'])
    n8nHeaders = r.headers();
});
ctx.on('response', async r => {
  if (r.url().startsWith(N8N + '/rest/workflows') && r.status() === 200 && !capturedWF) {
    try { const d = JSON.parse(await r.text()); if ((d.data||[]).length >= 10) capturedWF = d; } catch {}
  }
});

const page = await ctx.newPage();
await page.goto(N8N + '/home/workflows', { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(8000);
if (page.url().includes('signin')) { console.log('Expired'); await ctx.close(); process.exit(1); }

async function api(path, method = 'GET', body = null) {
  const r = await page.evaluate(async ({url, method, body, bid, pr}) => {
    const h = {'accept':'application/json','content-type':'application/json'};
    if (bid) h['browser-id'] = bid;
    if (pr) h['push-ref'] = pr;
    const o = {method, credentials:'include', headers:h};
    if (body) o.body = JSON.stringify(body);
    const res = await fetch(url, o);
    return {ok: res.ok, status: res.status, text: await res.text()};
  }, {url:`${N8N}/rest${path}`, method, body, bid: n8nHeaders['browser-id'], pr: n8nHeaders['push-ref']});
  try { return {ok:r.ok, status:r.status, data:JSON.parse(r.text)}; }
  catch { return {ok:r.ok, status:r.status, data:r.text}; }
}

await page.goto(N8N + '/home/workflows', { waitUntil: 'domcontentloaded' });

const wfs = capturedWF?.data || [];
console.log(`Workflows: ${wfs.length}`);

// Inspect 3 workflows that likely have Airtable
const airtableWFs = wfs.filter(w => /airtable|calendar|gmail/i.test(w.name));
for (const wf of airtableWFs.slice(0, 3)) {
  console.log(`\n--- WF: "${wf.name}" [${wf.id}] ---`);
  const d = await api(`/workflows/${wf.id}`);
  console.log(`  Status: ${d.status}`);
  if (d.ok) {
    const nodes = d.data?.nodes || [];
    console.log(`  Nodes: ${nodes.length}`);
    for (const n of nodes.slice(0, 5)) {
      console.log(`  Node "${n.name}" type:${n.type}`);
      if (n.credentials) {
        console.log(`    Credentials:`, JSON.stringify(n.credentials));
      }
    }
    // Raw first 1000 chars of response
    console.log(`  Keys: ${Object.keys(d.data||{}).join(', ')}`);
  } else {
    console.log(`  Error:`, JSON.stringify(d.data).slice(0,200));
  }
}

await ctx.close();
