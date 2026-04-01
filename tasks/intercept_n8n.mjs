/**
 * Intercept n8n API calls to understand auth headers
 */
import { chromium } from 'playwright';
import { writeFile } from 'fs/promises';

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile-auto';
const N8N = 'https://iszapfalo.app.n8n.cloud';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  viewport: { width: 1400, height: 900 },
});

const page = await ctx.newPage();
const capturedRequests = [];

// Intercept all /rest/ requests to capture headers
page.on('request', req => {
  if (req.url().includes('/rest/')) {
    capturedRequests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
    });
  }
});

page.on('response', res => {
  if (res.url().includes('/rest/')) {
    const match = capturedRequests.find(r => r.url === res.url());
    if (match) match.responseStatus = res.status();
  }
});

// Navigate to trigger n8n to make API calls
console.log('Navigating to n8n...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(4000);
console.log('URL:', page.url());

// Navigate to credentials to trigger more API calls
await page.goto(`${N8N}/home/credentials`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(3000);

console.log(`\nCaptured ${capturedRequests.length} /rest/ requests:`);
for (const req of capturedRequests.slice(0, 20)) {
  console.log(`\n${req.method} ${req.url.replace(N8N, '')} → ${req.responseStatus}`);
  // Show auth headers
  const authHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (['cookie', 'authorization', 'x-n8n-token', 'x-auth-token', 'csrf', 'x-requested-with'].some(h => k.toLowerCase().includes(h))) {
      authHeaders[k] = v.slice(0, 80) + (v.length > 80 ? '...' : '');
    }
  }
  console.log('Auth headers:', JSON.stringify(authHeaders));
}

// Now get all data while on the page
const cookies = await ctx.cookies();
const n8nCookies = cookies.filter(c => c.domain.includes('n8n'));
console.log('\nn8n cookies:', n8nCookies.map(c => `${c.name}=${c.value.slice(0,40)}...`));

// Try direct API call replicating exact headers
if (capturedRequests.length > 0) {
  const sampleReq = capturedRequests[0];
  console.log('\nTrying to replicate API call with captured headers...');
  
  const result = await page.evaluate(async ({headers, base}) => {
    // Use the exact same headers as n8n
    const res = await fetch(base + '/rest/workflows?limit=100', {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    return { status: res.status, text: (await res.text()).slice(0, 500) };
  }, { headers: sampleReq.headers, base: N8N });
  
  console.log('Replicated call result:', result.status, result.text.slice(0, 200));
}

await writeFile('tasks/n8n_requests.json', JSON.stringify(capturedRequests.slice(0, 30), null, 2));
console.log('\nSaved to tasks/n8n_requests.json');

await ctx.close();
