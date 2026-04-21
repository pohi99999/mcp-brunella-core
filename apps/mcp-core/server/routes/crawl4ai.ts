/**
 * Crawl4AI REST API Routes — Dashboard és CLI számára
 *
 * GET  /api/crawl4ai/status   — Crawl4AI szolgáltatás állapota
 * POST /api/crawl4ai/crawl    — Egyedi URL crawlolása
 * POST /api/crawl4ai/batch    — Több URL párhuzamos crawlolása
 */

import { Router } from "express";
import { crawl4aiCrawlHandler, crawl4aiBatchHandler } from "../../tools/crawl4aiTool.js";
import { logInfo, logError } from "../../utils/logger.js";
import { socketService } from "@packages/agents/SocketService.js";

const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

export function createCrawl4aiRouter(): Router {
  const router = Router();

  // GET /api/crawl4ai/status — Ellenőrzi a Crawl4AI Python szolgáltatás elérhetőségét
  router.get("/status", async (_req, res) => {
    try {
      const healthRes = await fetch(`${PYTHON_API}/health`, { signal: AbortSignal.timeout(5000) });
      const health = await healthRes.json() as Record<string, unknown>;
      const statusPayload = {
        available: true,
        python_api: PYTHON_API,
        health,
        timestamp: new Date().toISOString(),
      };
      socketService.emit("crawl4ai:status", statusPayload);
      res.json(statusPayload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const statusPayload = {
        available: false,
        python_api: PYTHON_API,
        error: msg,
        timestamp: new Date().toISOString(),
      };
      socketService.emit("crawl4ai:status", statusPayload);
      res.json(statusPayload);
    }
  });

  // POST /api/crawl4ai/crawl — Egyedi URL crawlolása
  router.post("/crawl", async (req, res) => {
    try {
      const { url, extract_schema, wait_for_selector } = req.body as {
        url?: string;
        extract_schema?: string;
        wait_for_selector?: string;
      };

      if (!url) {
        res.status(400).json({ success: false, error: "URL megadása kötelező" });
        return;
      }

      logInfo("crawl4ai-route", `Crawl request: ${url}`);
      socketService.emit("crawl4ai:progress", { url, status: "started", timestamp: Date.now() });
      const result = await crawl4aiCrawlHandler({ url, extract_schema, wait_for_selector });
      socketService.emit("crawl4ai:progress", { url, status: "completed", timestamp: Date.now() });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("crawl4ai-route", msg);
      socketService.emit("crawl4ai:progress", { url: (req.body as Record<string, unknown>)?.url ?? "unknown", status: "failed", error: msg, timestamp: Date.now() });
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/crawl4ai/batch — Több URL párhuzamos crawlolása
  router.post("/batch", async (req, res) => {
    try {
      const { urls, extract_schema } = req.body as {
        urls?: string[];
        extract_schema?: string;
      };

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ success: false, error: "URL lista megadása kötelező (urls: string[])" });
        return;
      }

      logInfo("crawl4ai-route", `Batch crawl request: ${urls.length} URLs`);
      socketService.emit("crawl4ai:batch-progress", { urlCount: urls.length, status: "started", timestamp: Date.now() });
      const result = await crawl4aiBatchHandler({ urls, extract_schema });
      socketService.emit("crawl4ai:batch-progress", { urlCount: urls.length, status: "completed", timestamp: Date.now() });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("crawl4ai-route", msg);
      socketService.emit("crawl4ai:batch-progress", { urlCount: ((req.body as Record<string, unknown>)?.urls as unknown[] | undefined)?.length ?? 0, status: "failed", error: msg, timestamp: Date.now() });
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
