/**
 * Crawl4AI MCP Tool — Intelligens web crawling és struktúrált adatkinyerés
 */
import { logInfo, logError } from "../utils/logger.js";
import { CrawlResultSchema, validatePythonResponse } from "../utils/pythonBridge.js";

const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

export async function crawl4aiCrawlHandler(params: {
  url: string;
  extract_schema?: string;
  wait_for_selector?: string;
}) {
  logInfo("crawl4ai", `Crawling: ${params.url}`);
  try {
    const body: Record<string, unknown> = { url: params.url };
    if (params.extract_schema) {
      body.extract_schema = JSON.parse(params.extract_schema);
    }
    if (params.wait_for_selector) {
      body.wait_for_selector = params.wait_for_selector;
    }

    const response = await fetch(`${PYTHON_API}/crawl4ai/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText}` };
    }

    const data = await response.json();
    const validated = validatePythonResponse(CrawlResultSchema, data, "/crawl4ai/crawl");
    if (!validated.success) {
      logError("crawl4ai", `Validation warning: ${validated.errors.join(", ")}`);
      return { success: true, data, validation_warning: validated.errors.join(", ") };
    }

    logInfo("crawl4ai", `Crawled ${params.url} — ${validated.data.markdown?.length ?? 0} chars`);
    return { success: true, data: validated.data };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("crawl4ai", error);
    return { success: false, error };
  }
}

export async function crawl4aiBatchHandler(params: {
  urls: string[];
  extract_schema?: string;
}) {
  logInfo("crawl4ai", `Batch crawling ${params.urls.length} URLs`);
  try {
    const body: Record<string, unknown> = { urls: params.urls };
    if (params.extract_schema) {
      body.extract_schema = JSON.parse(params.extract_schema);
    }

    const response = await fetch(`${PYTHON_API}/crawl4ai/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText}` };
    }

    const data = await response.json();
    logInfo("crawl4ai", `Batch done: ${(data as { results?: unknown[] }).results?.length ?? 0} results`);
    return { success: true, data };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("crawl4ai", error);
    return { success: false, error };
  }
}
