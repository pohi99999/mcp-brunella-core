/**
 * Use Playwright's APIRequestContext to call n8n REST API
 * This bypasses browser fetch restrictions and uses the JWT directly
 */
import { chromium, request } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-fresh-142639';
const N8N = 'https://iszapfalo.app.n8n.cloud';

console.log('=== n8n API via Playwright request context ===');

// Step 1: Get the JWT from the browser context
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  viewport: { width: 1400, height: 900 },
});

const page = await ctx.newPage();
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(3000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired!');
  await ctx.close();
  process.exit(1);
}

console.log('✅ Logged in! URL:', page.url());

// Get the n8n-auth cookie
const cookies = await ctx.cookies();
const n8nAuth = cookies.find(c => c.name === 'n8n-auth');
console.log('n8n-auth:', n8nAuth ? n8nAuth.value.slice(0, 60) + '...' : 'NOT FOUND');

if (!n8nAuth) {
  console.log('All cookies:', cookies.map(c => c.name));
  await ctx.close();
  process.exit(1);
}

// Step 2: Use ctx.request (APIRequestContext) to make authenticated API calls
console.log('\nTesting API calls via ctx.request...');

// First test: settings (public)
const settingsResp = await ctx.request.get(`${N8N}/rest/settings`, {
  headers: { 'Accept': 'application/json', 'Cookie': `n8n-auth=${n8nAuth.value}` }
});
console.log('/settings:', settingsResp.status());

// Second test: workflows (authenticated)
const wfResp = await ctx.request.get(`${N8N}/rest/workflows?limit=100`, {
  headers: { 'Accept': 'application/json', 'Cookie': `n8n-auth=${n8nAuth.value}` }
});
console.log('/workflows:', wfResp.status());
const wfText = await wfResp.text();
console.log('Workflows response:', wfText.slice(0, 300));

// Third test: try with Bearer auth
const wfResp2 = await ctx.request.get(`${N8N}/rest/workflows?limit=100`, {
  headers: { 
    'Accept': 'application/json',
    'Cookie': `n8n-auth=${n8nAuth.value}`,
    'Authorization': `Bearer ${n8nAuth.value}`,
    'X-Requested-With': 'XMLHttpRequest'
  }
});
console.log('/workflows (Bearer):', wfResp2.status());

// Fourth test: try credentials
const credResp = await ctx.request.get(`${N8N}/rest/credentials?limit=100`, {
  headers: { 'Accept': 'application/json', 'Cookie': `n8n-auth=${n8nAuth.value}` }
});
console.log('/credentials:', credResp.status());
const credText = await credResp.text();
console.log('Credentials response:', credText.slice(0, 300));

// Fifth: check what n8n REST API v1 requires
const meResp = await ctx.request.get(`${N8N}/rest/me`, {
  headers: { 'Accept': 'application/json', 'Cookie': `n8n-auth=${n8nAuth.value}` }
});
console.log('/me:', meResp.status(), (await meResp.text()).slice(0, 200));

// Save the JWT for use later
await writeFile('tasks/n8n_jwt.txt', n8nAuth.value);
console.log('\nJWT saved to tasks/n8n_jwt.txt');

await ctx.close();
