import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

const USER_DATA_DIR = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile-pw-copy';

console.log('Testing with copied profile...');

const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1280, height: 900 }
});

const page = await ctx.newPage();

try {
  await page.goto('https://iszapfalo.app.n8n.cloud/home/workflows', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const url = page.url();
  const title = await page.title();
  console.log('URL:', url);
  console.log('Title:', title);
  await page.screenshot({ path: 'tasks/screenshots/profile_test.png' });
  
  if (!url.includes('/signin')) {
    console.log('✅ Logged in with copied profile!');
    
    // List workflows
    const wfCards = await page.locator('[class*="card"], [class*="workflow"]').allTextContents().catch(() => []);
    console.log('Workflows found:', wfCards.slice(0, 5).join(' | ').slice(0, 200));
    
    // Get cookies
    const cookies = await ctx.cookies('https://iszapfalo.app.n8n.cloud');
    const n8nCookie = cookies.find(c => c.name === 'n8n-auth');
    console.log('n8n-auth cookie:', n8nCookie ? `expires=${new Date(n8nCookie.expires * 1000).toISOString()}` : 'not found');
    console.log('All n8n cookies:', cookies.map(c => c.name));
  } else {
    console.log('❌ Redirected to signin - session not valid');
    const cookies = await ctx.cookies('https://iszapfalo.app.n8n.cloud');
    console.log('Available cookies:', cookies.map(c => `${c.name}=${c.value.slice(0,20)}`));
  }
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await ctx.close();
}
