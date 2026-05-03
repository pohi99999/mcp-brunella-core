const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER PAGE ERROR: ${err.message}`));
  page.on('requestfailed', req => console.log(`BROWSER REQUEST FAILED: ${req.url()} - ${req.failure().errorText}`));

  console.log('Navigating to http://127.0.0.1:3000 ...');
  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded.');
    
    console.log('Waiting for content to appear (10s)...');
    await page.waitForTimeout(10000);
    
    const bodyText = await page.innerText('body');
    console.log('Body text length:', bodyText.length);
    console.log('Body text:', bodyText);
    
    const html = await page.content();
    console.log('HTML contains #root:', html.includes('id="root"'));
    console.log('HTML contains script:', html.includes('script'));
    
    const rootInner = await page.innerHTML('#root');
    console.log('Root inner HTML:', rootInner);

  } catch (e) {
    console.error('Test failed:', e);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
