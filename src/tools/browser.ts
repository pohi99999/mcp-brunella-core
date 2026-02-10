import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Browser, Page } from 'playwright';
import { URL } from 'url';
import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs';
import { CloudflareBrowserAPI } from '../utils/browserRendering.js';

// Create singleton instance for CF Browser API
const cloudflareBrowserAPI = new CloudflareBrowserAPI();

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

      const options: Options = {
        mode: 'text',
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
        const messages = await PythonShell.run(path.basename(scriptPath), options);
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

  // --- Cloudflare Browser Rendering API Tools ---

  server.tool(
    "cf_browser_screenshot",
    "Domain-free screenshot using Cloudflare Browser Rendering API. Supports localhost, IPs, and any URL without custom domain requirements.",
    {
      url: z.string().url().describe("URL to capture screenshot from (supports localhost, IPs, any domain)"),
      format: z.enum(["jpeg", "png"]).optional().default("png").describe("Image format"),
      fullPageScreenshot: z.boolean().optional().describe("Take full page screenshot"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional().default("load").describe("Wait condition"),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
      viewportWidth: z.number().optional().default(1920).describe("Viewport width"),
      viewportHeight: z.number().optional().default(1080).describe("Viewport height"),
    },
    async ({ url, format = "png", fullPageScreenshot, waitUntil = "load", timeout = 30000, viewportWidth = 1920, viewportHeight = 1080 }) => {
      try {
        const result = await cloudflareBrowserAPI.screenshot({
          url,
          format,
          fullPage: fullPageScreenshot,
          viewport: { width: viewportWidth, height: viewportHeight },
          waitFor: waitUntil === "networkidle" ? 5000 : undefined // Convert to timeout for networkidle
        });

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: "text", text: `CF Browser API Error: ${result.error}` }]
          };
        }

        // Convert Buffer to base64
        const base64Image = result.data ? Buffer.from(result.data).toString('base64') : '';

        return {
          content: [{
            type: "image",
            data: base64Image,
            mimeType: format === "png" ? "image/png" : "image/jpeg"
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Cloudflare Browser API error: ${error.message}` }]
        };
      }
    }
  );

  server.tool(
    "cf_browser_pdf",
    "Generate PDF using Cloudflare Browser Rendering API with advanced options.",
    {
      url: z.string().url().describe("URL to generate PDF from"),
      format: z.enum(["A0", "A1", "A2", "A3", "A4", "A5", "A6", "Letter", "Legal", "Tabloid", "Ledger"]).optional().default("A4").describe("PDF paper format"),
      orientation: z.enum(["portrait", "landscape"]).optional().default("portrait").describe("PDF orientation"),
      printBackground: z.boolean().optional().default(true).describe("Include background graphics"),
      marginTop: z.number().optional().describe("Top margin in inches"),
      marginBottom: z.number().optional().describe("Bottom margin in inches"),
      marginLeft: z.number().optional().describe("Left margin in inches"),
      marginRight: z.number().optional().describe("Right margin in inches"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional().default("load").describe("Wait condition"),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
    },
    async ({ url, format = "A4", orientation = "portrait", printBackground = true, marginTop, marginBottom, marginLeft, marginRight, waitUntil = "load", timeout = 30000 }) => {
      try {
        const result = await cloudflareBrowserAPI.generatePDF({
          url,
          // Note: CF Browser API might not support all PDF-specific options, 
          // keeping basic options that align with screenshot interface
          viewport: { width: 1920, height: 1080 },
          fullPage: true, // PDFs typically capture full page
          waitFor: waitUntil === "networkidle" ? 5000 : undefined
        });

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: "text", text: `CF Browser API Error: ${result.error}` }]
          };
        }

        // Convert Buffer to base64
        const base64PDF = result.data ? Buffer.from(result.data).toString('base64') : '';

        return {
          content: [{
            type: "resource",
            resource: {
              uri: `data:application/pdf;base64,${base64PDF}`,
              mimeType: "application/pdf",
              text: `PDF generated from ${url}`,
            }
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Cloudflare Browser PDF error: ${error.message}` }]
        };
      }
    }
  );

  server.tool(
    "cf_quick_screenshot",
    "Quick screenshot with default settings using Cloudflare Browser Rendering API.",
    {
      url: z.string().url().describe("URL to capture screenshot from"),
    },
    async ({ url }) => {
      try {
        const result = await cloudflareBrowserAPI.quickScreenshot(url);

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: "text", text: `CF Browser API Error: ${result.error}` }]
          };
        }

        // Convert Buffer to base64
        const base64Image = result.data ? Buffer.from(result.data).toString('base64') : '';

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
          content: [{ type: "text", text: `Cloudflare Quick Screenshot error: ${error.message}` }]
        };
      }
    }
  );
}
