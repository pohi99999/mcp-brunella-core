/**
 * n8n API Helper - Get workflows, credentials, and nodes
 * Uses the n8n-auth cookie for authentication
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const USER_DATA_DIR = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile-pw-copy';
const N8N = 'https://iszapfalo.app.n8n.cloud';

const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1280, height: 900 }
});

const page = await ctx.newPage();
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 20000 });

// Get the auth cookie
const cookies = await ctx.cookies(N8N);
const n8nAuth = cookies.find(c => c.name === 'n8n-auth');
console.log('Auth cookie found:', !!n8nAuth);

// Helper to call n8n API
async function apiCall(endpoint, method = 'GET', body = null) {
  const result = await page.evaluate(async ({url, method, body}) => {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return { status: r.status, body: await r.text() };
  }, { url: `${N8N}/rest${endpoint}`, method, body });
  
  try {
    return { status: result.status, data: JSON.parse(result.body) };
  } catch {
    return { status: result.status, data: result.body };
  }
}

// ── 1. List all workflows ─────────────────────────────────────────
console.log('\n=== Listing Workflows ===');
const wfResp = await apiCall('/workflows?limit=100');
console.log('Status:', wfResp.status);

const workflows = wfResp.data?.data || wfResp.data || [];
const wfList = Array.isArray(workflows) ? workflows : [];
console.log(`Found ${wfList.length} workflows:`);
for (const wf of wfList) {
  console.log(`  [${wf.id}] "${wf.name}" - active:${wf.active}`);
}

// ── 2. List all credentials ───────────────────────────────────────
console.log('\n=== Listing Credentials ===');
const credResp = await apiCall('/credentials');
const creds = credResp.data?.data || credResp.data || [];
const credList = Array.isArray(creds) ? creds : [];
console.log(`Found ${credList.length} credentials:`);
for (const cred of credList) {
  console.log(`  [${cred.id}] "${cred.name}" - type:${cred.type}`);
}

// ── 3. Save data for TODO processing ─────────────────────────────
await writeFile('tasks/n8n_data.json', JSON.stringify({
  workflows: wfList,
  credentials: credList
}, null, 2));
console.log('\nData saved to tasks/n8n_data.json');

await ctx.close();
