import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Browser, Page } from 'playwright';
import { URL } from 'url';

// Security check for URLs (same as before)
function isUrlAllowed(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        if (url.protocol === 'file:') return false;
        
        const hostname = url.hostname;
        if (hostname === 'localhost') return false;
        if (hostname.startsWith('127.')) return false;
        if (hostname.startsWith('192.168.')) return false;
        if (hostname.startsWith('10.')) return false;
        if (hostname.endsWith('.local')) return false;

        return true;
    } catch {
        return false;
    }
}

// Global browser instance
let browser: Browser | null = null;

async function getBrowser() {
    if (!browser) {
        // We use playwright-core which doesn't bundle browsers, 
        // but we assume the user has a way to get one or we installed 'playwright' which does.
        // Actually, 'playwright' package installs browsers.
        // Let's try to launch.
        try {
            const { chromium } = await import('playwright');
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer in some envs, standard for server-side
            });
        } catch (e: any) {
            throw new Error(`Failed to load playwright: ${e.message}. Browser tools are not available in this environment.`);
        }
    }
    return browser;
}

export function registerBrowserTools(server: McpServer) {
  
  server.tool(
    "browser_navigate",
    "Navigates to a URL and returns the page content (text/html). Handles JS.",
    {
      url: z.string().url().describe("The URL to fetch"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before returning"),
    },
    async ({ url, waitForSelector }) => {
      if (!isUrlAllowed(url)) {
          return {
              isError: true,
              content: [{ type: "text", text: "Access denied: Local or file URLs are not allowed." }]
          };
      }

      let page: Page | null = null;
      try {
        const browser = await getBrowser();
        if (!browser) throw new Error("Browser not initialized");

        page = await browser.newPage();
        
        await page.goto(url, { waitUntil: 'networkidle' }); // Wait for network to settle

        if (waitForSelector) {
            try {
                await page.waitForSelector(waitForSelector, { timeout: 5000 });
            } catch (e) {
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
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Browser error: ${error.message}` }]
        };
      } finally {
        if (page) await page.close();
      }
    }
  );

  server.tool(
    "browser_screenshot",
    "Takes a screenshot of a URL.",
    {
      url: z.string().url().describe("The URL to screenshot"),
    },
    async ({ url }) => {
      if (!isUrlAllowed(url)) {
          return { isError: true, content: [{ type: "text", text: "Access denied." }] };
      }

      let page: Page | null = null;
      try {
        const browser = await getBrowser();
        if (!browser) throw new Error("Browser not initialized");

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
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Screenshot error: ${error.message}` }]
        };
      } finally {
        if (page) await page.close();
      }
    }
  );
}
