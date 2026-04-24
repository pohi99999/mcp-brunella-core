import { test, expect } from '@playwright/test';

test('Network and Console Audit', async ({ page }) => {
    page.on('console', msg => console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`));
    page.on('request', request => console.log(`REQUEST: ${request.method()} ${request.url()}`));
    page.on('response', response => console.log(`RESPONSE: ${response.status()} ${response.url()}`));
    page.on('requestfailed', request => console.log(`FAILED: ${request.url()} - ${request.failure()?.errorText}`));

    console.log('Navigating to http://127.0.0.1:3000');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'load', timeout: 60000 });
    
    console.log('Waiting for splash screen (8s)...');
    await page.waitForTimeout(8000);
    
    const content = await page.content();
    console.log('Final HTML length:', content.length);
    console.log('Body Text:', await page.innerText('body'));
    
    // Take a screenshot and save it to a known location
    await page.screenshot({ path: 'audit-screenshot.png' });
});
