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

// Navigate to n8n first to establish session context
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
console.log('Current URL:', page.url());

// Intercept API calls made by n8n frontend to learn what auth headers are used
const apiResponses = [];
page.on('response', async resp => {
  const url = resp.url();
  if (url.includes('/rest/') && resp.status() < 400) {
    try {
      const body = await resp.text();
      const parsed = JSON.parse(body);
      apiResponses.push({ url: url.replace(N8N, ''), status: resp.status(), dataKeys: Object.keys(parsed) });
    } catch {}
  }
});

page.on('request', req => {
  const url = req.url();
  if (url.includes('/rest/workflows') || url.includes('/rest/credentials')) {
    const headers = req.headers();
    console.log(`API Request: ${req.method()} ${url.replace(N8N, '')}`);
    const importantHeaders = Object.entries(headers).filter(([k]) => 
      k.toLowerCase().includes('auth') || k.toLowerCase().includes('cookie') || 
      k.toLowerCase().includes('token') || k.toLowerCase() === 'x-n8n-api-key' ||
      k.toLowerCase() === 'accept'
    );
    console.log('  Auth headers:', JSON.stringify(importantHeaders));
  }
});

// Wait for the page to load and make API calls
await page.waitForTimeout(5000);

console.log('\nAPI responses intercepted:', apiResponses.slice(0, 5));

// Now try to call the API directly from the page context
const result = await page.evaluate(async () => {
  // First try to get CSRF token or auth token from the page
  const meta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = meta?.content || null;
  
  // Check if n8n stores auth in localStorage or sessionStorage
  const localKeys = Object.keys(localStorage);
  const sessionKeys = Object.keys(sessionStorage);
  
  // Try to get auth token from n8n app state
  const n8nState = window.__n8n__ || window.n8n || null;
  
  // Make API call
  const r = await fetch('/rest/workflows?limit=50', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'browser-id': localStorage.getItem('n8n-browser-id') || ''
    }
  });
  
  return {
    csrfToken,
    localKeys: localKeys.slice(0, 20),
    sessionKeys: sessionKeys.slice(0, 10),
    apiStatus: r.status,
    apiBody: (await r.text()).slice(0, 500)
  };
});

console.log('\nPage context results:');
console.log('CSRF token:', result.csrfToken);
console.log('LocalStorage keys:', result.localKeys);
console.log('SessionStorage keys:', result.sessionKeys);
console.log('API status:', result.apiStatus);
console.log('API body:', result.apiBody.slice(0, 200));

await ctx.close();
