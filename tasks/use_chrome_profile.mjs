import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tasks/screenshots', { recursive: true });

console.log('Trying to reuse Chrome profile session...');

// Use the existing Chrome profile which has the n8n-auth session cookie
const userDataDir = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile';

try {
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 1280, height: 900 }
  });

  const page = await ctx.newPage();
  
  console.log('Navigating to n8n dashboard...');
  await page.goto('https://iszapfalo.app.n8n.cloud/home/workflows', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const url = page.url();
  const title = await page.title();
  console.log('URL:', url);
  console.log('Title:', title);
  await page.screenshot({ path: 'tasks/screenshots/chrome_profile_test.png' });
  
  if (!url.includes('/signin')) {
    console.log('✅ Already logged in via saved session!');
    
    // Navigate to credentials
    await page.goto('https://iszapfalo.app.n8n.cloud/home/credentials', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log('Credentials URL:', page.url());
    await page.screenshot({ path: 'tasks/screenshots/credentials_page.png' });
    
    // List visible credentials
    const cards = await page.locator('[class*="card"], [class*="list"]').allTextContents().catch(() => []);
    console.log('Credential items (first 5):', cards.slice(0, 5));
  } else {
    console.log('❌ Redirected to signin - session expired or not saved');
    
    // Check what cookies are available
    const cookies = await ctx.cookies('https://iszapfalo.app.n8n.cloud');
    console.log('Cookies for n8n:', cookies.map(c => `${c.name}=${c.value.slice(0,30)}`));
  }
  
  await ctx.close();
} catch(e) {
  console.error('Error:', e.message);
  
  // Fallback: try with fresh context and manually set cookie
  console.log('\nFallback: trying with manual cookie injection...');
}
