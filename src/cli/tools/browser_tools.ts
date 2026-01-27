import { toolRegistry } from './registry';
import { chromium } from 'playwright';
import path from 'path';

// Scrape Page Tool
toolRegistry.registerTool({
    name: 'scrape_page',
    description: 'Scrapes the text content of a webpage using Playwright',
    execute: async ({ url }) => {
        if (!url) throw new Error('URL is required');
        
        console.log(`Launching browser to scrape: ${url}`);
        const browser = await chromium.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const content = await page.evaluate(() => document.body.innerText);
            return content.substring(0, 10000); // Limit content size
        } catch (e: any) {
            throw new Error(`Failed to scrape page: ${e.message}`);
        } finally {
            await browser.close();
        }
    }
});

// Screenshot Tool
toolRegistry.registerTool({
    name: 'screenshot',
    description: 'Takes a screenshot of a webpage',
    execute: async ({ url, output }) => {
        if (!url) throw new Error('URL is required');
        const outputPath = output || `screenshot_${Date.now()}.png`;
        const fullPath = path.resolve(process.cwd(), outputPath);

        console.log(`Taking screenshot of ${url} to ${outputPath}...`);
        const browser = await chromium.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.screenshot({ path: fullPath });
            return `Screenshot saved to ${outputPath}`;
        } catch (e: any) {
            throw new Error(`Failed to take screenshot: ${e.message}`);
        } finally {
            await browser.close();
        }
    }
});
