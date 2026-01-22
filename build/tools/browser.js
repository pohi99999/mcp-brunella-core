"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserTools = registerBrowserTools;
const zod_1 = require("zod");
const playwright_core_1 = require("playwright-core");
const url_1 = require("url");
// Security check for URLs (same as before)
function isUrlAllowed(urlStr) {
    try {
        const url = new url_1.URL(urlStr);
        if (url.protocol === 'file:')
            return false;
        const hostname = url.hostname;
        if (hostname === 'localhost')
            return false;
        if (hostname.startsWith('127.'))
            return false;
        if (hostname.startsWith('192.168.'))
            return false;
        if (hostname.startsWith('10.'))
            return false;
        if (hostname.endsWith('.local'))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
// Global browser instance
let browser = null;
async function getBrowser() {
    if (!browser) {
        // We use playwright-core which doesn't bundle browsers, 
        // but we assume the user has a way to get one or we installed 'playwright' which does.
        // Actually, 'playwright' package installs browsers.
        // Let's try to launch.
        browser = await playwright_core_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer in some envs, standard for server-side
        });
    }
    return browser;
}
function registerBrowserTools(server) {
    server.tool("browser_navigate", "Navigates to a URL and returns the page content (text/html). Handles JS.", {
        url: zod_1.z.string().url().describe("The URL to fetch"),
        waitForSelector: zod_1.z.string().optional().describe("CSS selector to wait for before returning"),
    }, async ({ url, waitForSelector }) => {
        if (!isUrlAllowed(url)) {
            return {
                isError: true,
                content: [{ type: "text", text: "Access denied: Local or file URLs are not allowed." }]
            };
        }
        let page = null;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle' }); // Wait for network to settle
            if (waitForSelector) {
                try {
                    await page.waitForSelector(waitForSelector, { timeout: 5000 });
                }
                catch (e) {
                    // Ignore timeout, just return what we have
                }
            }
            // Get readable text content
            const text = await page.evaluate(() => document.body.innerText);
            const title = await page.title();
            return {
                content: [{
                        type: "text",
                        text: `Title: ${title}\n\nContent:\n${text.slice(0, 50000)}` // Limit content
                    }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Browser error: ${error.message}` }]
            };
        }
        finally {
            if (page)
                await page.close();
        }
    });
    server.tool("browser_screenshot", "Takes a screenshot of a URL.", {
        url: zod_1.z.string().url().describe("The URL to screenshot"),
    }, async ({ url }) => {
        if (!isUrlAllowed(url)) {
            return { isError: true, content: [{ type: "text", text: "Access denied." }] };
        }
        let page = null;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle' });
            const screenshot = await page.screenshot({ type: 'png' });
            const base64Image = screenshot.toString('base64');
            return {
                content: [{
                        type: "image",
                        data: base64Image,
                        mimeType: "image/png"
                    }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Screenshot error: ${error.message}` }]
            };
        }
        finally {
            if (page)
                await page.close();
        }
    });
}
