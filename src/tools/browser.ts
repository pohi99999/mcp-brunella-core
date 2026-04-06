import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// @ts-expect-error
import type { Browser, Page } from 'playwright';
import { URL } from 'url';
import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';
import { CloudflareBrowserAPI } from '../utils/browserRendering.js';

// Lazy singleton – won't throw at import time if env vars are missing
let _cfBrowser: CloudflareBrowserAPI | null = null;
function getCfBrowser(): CloudflareBrowserAPI {
  if (!_cfBrowser) _cfBrowser = new CloudflareBrowserAPI();
  return _cfBrowser;
}

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
      // @ts-expect-error
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

const PYTHON_API = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

export function registerBrowserTools(server: McpServer) {

  // --- Robotkéz Harvest Tools (Python browser_worker proxy) ---

  server.tool(
    "harvest_scenario",
    "Runs a Robotkéz browser automation scenario (n8n workflow creation, data extraction, etc). Calls the Python browser_worker.",
    {
      scenario_path: z.string().describe("Path to scenario JSON file, e.g. myai/scenarios/n8n_training.json"),
      force_mode: z.enum(["api", "ui"]).optional().describe("Force API or UI mode (default: auto-detect)"),
    },
    async ({ scenario_path, force_mode }) => {
      try {
        const response = await fetch(`${PYTHON_API}/harvest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario_path, force_mode }),
          signal: AbortSignal.timeout(120000),
        });
        const data = await response.json() as any;
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Harvest error: ${error.message}` }]
        };
      }
    }
  );

  server.tool(
    "harvest_extract",
    "Structured data extraction from a URL using a JSON schema (Pydantic validated).",
    {
      target_url: z.string().url().describe("URL to extract data from"),
      schema_source: z.string().describe("JSON schema file path or raw JSON string"),
      extraction_prompt: z.string().optional().describe("Custom extraction prompt"),
    },
    async ({ target_url, schema_source, extraction_prompt }) => {
      try {
        const response = await fetch(`${PYTHON_API}/harvest/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_url, schema_source, extraction_prompt }),
          signal: AbortSignal.timeout(120000),
        });
        const data = await response.json() as any;
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Extract error: ${error.message}` }]
        };
      }
    }
  );

  // --- Playwright Direct Tools (existing) ---


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

  // --- Robotkéz CLI-Based Tool (python-shell bridge) ---

  server.tool(
    "browser_action",
    "Autonóm böngésző vezérlés (Robotkéz CLI). Képes weboldalakat megnyitni, kattintani, gépelni és adatokat kinyerni.",
    {
      task: z.string().describe('A feladat részletes leírása (pl. "Menj a google.com-ra és keress rá erre...")'),
      headless: z.boolean().optional().default(true).describe('Fusson-e háttérben a böngésző (default: true)'),
      use_vision: z.boolean().optional().default(true).describe('Használja-e az AI a látást (screenshot elemzés) (default: true)'),
    },
    async ({ task, headless = true, use_vision = true }) => {
      const scriptPath = path.resolve(process.cwd(), 'myai/browser_task_runner.py');

      if (!fs.existsSync(scriptPath)) {
        return {
          isError: true,
          content: [{ type: "text", text: `Python script not found at: ${scriptPath}` }]
        };
      }

      const options = {
        mode: 'text' as const,
        pythonPath: 'python',
        pythonOptions: ['-u'],
        scriptPath: path.dirname(scriptPath),
        args: [
          '--task', task,
          '--headless', String(headless),
          '--vision', String(use_vision)
        ]
      };

      try {
        const messages = await PythonShell.run(path.basename(scriptPath), options as any);
        const lastMessage = messages[messages.length - 1];
        const result = JSON.parse(lastMessage);

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: "text", text: `Browser task failed: ${result.error || result.final_answer}` }]
          };
        }

        return {
          content: [{
            type: "text",
            text: `✅ Robotkéz Eredmény:\n\n${result.final_answer}\n\nMetadata: ${JSON.stringify(result.extracted_data, null, 2)}`
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Python execution error: ${error.message}` }]
        };
      }
    }
  );

  // --- Cloudflare Browser Rendering REST API Tools ---
  // 8 endpoints: /screenshot, /pdf, /content, /markdown, /snapshot, /scrape, /json, /links
  // Docs: https://developers.cloudflare.com/browser-rendering/rest-api/

  // 1. /screenshot – capture screenshot
  server.tool(
    "cf_screenshot",
    "Capture a screenshot of a URL or raw HTML using Cloudflare Browser Rendering REST API. Supports fullPage, viewport, selector, cookies, custom JS/CSS injection.",
    {
      url: z.string().optional().describe("URL to screenshot"),
      html: z.string().optional().describe("Raw HTML to render instead of URL"),
      fullPage: z.boolean().optional().describe("Capture the full scrollable page"),
      type: z.enum(["png", "jpeg"]).optional().default("png").describe("Image format"),
      quality: z.number().min(1).max(100).optional().describe("JPEG quality (1-100). Only valid when type=jpeg"),
      selector: z.string().optional().describe("CSS selector to screenshot a specific element"),
      omitBackground: z.boolean().optional().describe("Hide default white background (transparency)"),
      viewportWidth: z.number().optional().default(1920).describe("Viewport width"),
      viewportHeight: z.number().optional().default(1080).describe("Viewport height"),
      deviceScaleFactor: z.number().optional().describe("Device scale factor (2 for retina)"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Page load wait strategy"),
      timeout: z.number().optional().default(45000).describe("Navigation timeout in ms"),
    },
    async ({ url, html, fullPage, type = "png", quality, selector, omitBackground, viewportWidth = 1920, viewportHeight = 1080, deviceScaleFactor, waitUntil, timeout = 45000 }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.screenshot({
          ...(url && { url }),
          ...(html && { html }),
          ...(selector && { selector }),
          viewport: { width: viewportWidth, height: viewportHeight, ...(deviceScaleFactor && { deviceScaleFactor }) },
          screenshotOptions: {
            ...(fullPage && { fullPage }),
            ...(type && { type }),
            ...(quality && { quality }),
            ...(omitBackground && { omitBackground }),
          },
          gotoOptions: { ...(waitUntil && { waitUntil }), timeout },
        });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        const b64 = result.data ? result.data.toString('base64') : '';
        return { content: [{ type: "image", data: b64, mimeType: result.mimeType || "image/png" }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF screenshot error: ${e.message}` }] };
      }
    }
  );

  // 2. /pdf – generate PDF
  server.tool(
    "cf_pdf",
    "Generate a PDF from a URL or raw HTML using Cloudflare Browser Rendering. Supports paper format, margins, headers/footers, landscape mode.",
    {
      url: z.string().optional().describe("URL to render as PDF"),
      html: z.string().optional().describe("Raw HTML to render"),
      format: z.enum(["a0", "a1", "a2", "a3", "a4", "a5", "a6", "letter", "legal", "tabloid", "ledger"]).optional().default("a4").describe("Paper format"),
      landscape: z.boolean().optional().describe("Landscape orientation"),
      printBackground: z.boolean().optional().default(true).describe("Include background"),
      scale: z.number().optional().describe("Render scale (0.1 - 2.0)"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
      timeout: z.number().optional().default(45000).describe("Timeout ms"),
    },
    async ({ url, html, format = "a4", landscape, printBackground = true, scale, waitUntil, timeout = 45000 }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.pdf({
          ...(url && { url }),
          ...(html && { html }),
          pdfOptions: { format, ...(landscape && { landscape }), printBackground, ...(scale && { scale }) },
          gotoOptions: { ...(waitUntil && { waitUntil }), timeout },
        });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        const b64 = result.data ? result.data.toString('base64') : '';
        return { content: [{ type: "resource", resource: { uri: `data:application/pdf;base64,${b64}`, mimeType: "application/pdf", text: `PDF from ${url || 'HTML'}` } }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF pdf error: ${e.message}` }] };
      }
    }
  );

  // 3. /content – fetch fully rendered HTML
  server.tool(
    "cf_content",
    "Fetch fully rendered HTML of a URL (after JS execution) via Cloudflare Browser Rendering. Ideal for SPAs and JS-heavy pages.",
    {
      url: z.string().url().describe("URL to fetch rendered HTML from"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
      timeout: z.number().optional().default(45000).describe("Timeout ms"),
    },
    async ({ url, waitUntil, timeout = 45000 }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.content({ url, gotoOptions: { ...(waitUntil && { waitUntil }), timeout } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF content error: ${e.message}` }] };
      }
    }
  );

  // 4. /markdown – extract Markdown from webpage
  server.tool(
    "cf_markdown",
    "Extract Markdown from a webpage using Cloudflare Browser Rendering. Great for converting web content to readable Markdown.",
    {
      url: z.string().url().describe("URL to extract Markdown from"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
    },
    async ({ url, waitUntil }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.markdown({ url, gotoOptions: { ...(waitUntil && { waitUntil }) } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF markdown error: ${e.message}` }] };
      }
    }
  );

  // 5. /snapshot – take full DOM/accessibility snapshot
  server.tool(
    "cf_snapshot",
    "Take a full page DOM snapshot via Cloudflare Browser Rendering. Returns the accessibility tree / DOM structure.",
    {
      url: z.string().url().describe("URL to snapshot"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
    },
    async ({ url, waitUntil }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.snapshot({ url, gotoOptions: { ...(waitUntil && { waitUntil }) } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF snapshot error: ${e.message}` }] };
      }
    }
  );

  // 6. /scrape – extract HTML elements by CSS selector
  server.tool(
    "cf_scrape",
    "Scrape HTML elements by CSS selectors via Cloudflare Browser Rendering. Returns text, HTML, attributes, and dimensions for each match.",
    {
      url: z.string().url().describe("URL to scrape"),
      selectors: z.array(z.string()).describe("CSS selectors to extract (e.g. ['h1', 'a', '.price'])"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
    },
    async ({ url, selectors, waitUntil }) => {
      try {
        const cf = getCfBrowser();
        const elements = selectors.map(s => ({ selector: s }));
        const result = await cf.scrape({ url, elements, gotoOptions: { ...(waitUntil && { waitUntil }) } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF scrape error: ${e.message}` }] };
      }
    }
  );

  // 7. /json – AI-powered structured data extraction
  server.tool(
    "cf_json",
    "Extract structured data from a webpage using AI (natural language prompt) via Cloudflare Browser Rendering. Ideal for data extraction without writing selectors.",
    {
      url: z.string().url().describe("URL to extract data from"),
      prompt: z.string().describe("Natural language prompt describing what data to extract (e.g. 'Extract all product names and prices')"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
    },
    async ({ url, prompt, waitUntil }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.json({ url, prompt, gotoOptions: { ...(waitUntil && { waitUntil }) } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF json error: ${e.message}` }] };
      }
    }
  );

  // 8. /links – retrieve all links from a webpage
  server.tool(
    "cf_links",
    "Retrieve all links from a webpage via Cloudflare Browser Rendering. Returns href and text for each link.",
    {
      url: z.string().url().describe("URL to extract links from"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("Wait strategy"),
    },
    async ({ url, waitUntil }) => {
      try {
        const cf = getCfBrowser();
        const result = await cf.links({ url, gotoOptions: { ...(waitUntil && { waitUntil }) } });
        if (!result.success) return { isError: true, content: [{ type: "text", text: `CF Error: ${result.error}` }] };
        return { content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }] };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `CF links error: ${e.message}` }] };
      }
    }
  );
}
