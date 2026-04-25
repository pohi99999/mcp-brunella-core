/**
 * Gold Protocol G7.4: Cognitive Memory API Routes
 *
 * Golden dataset, index, and training API
 *
 * Endpoints:
 *   GET /api/memory/stats - Golden dataset + index stats
 *   POST /api/memory/golden - Save golden sample
 *   GET /api/memory/index-status - Codebase indexing status
 *   POST /api/memory/reindex - Trigger reindex
 *   POST /api/memory/train - Trigger nightly training
 */

import { Router } from "express";
import { exportGoldenDataset, getCuratedGoldenStats, getGoldenStats, syncLocalToD1 } from "../core/goldenDatasetBridge.js";
import { getIndexStatus, scheduleReindex } from "../core/codebaseIndexer.js";
import { exportStructuredMemories, getMemoryStats, getRecentPatternReuses, purgeExpired, queryMemory } from "../core/structuredMemory.js";
import { socketService } from "./SocketService.js";
import { getMemoryCacheMetricsSnapshot } from "../utils/metrics.js";
import { ensureError } from "../utils/ensureError.js";

export function createMemoryRouter(): Router {
  const router = Router();

  /**
   * GET /api/memory/stats
   * Get golden dataset + index statistics
   */
  router.get("/stats", async (_req, res) => {
    try {
      const golden = (await getGoldenStats()) ?? {
        totalSamples: 0,
        newSinceLastTraining: 0,
        lastTrainingAt: undefined,
      };
      const curated = getCuratedGoldenStats();
      const index = getIndexStatus(); // Already sync, returns status object

      res.json({ golden, curated, index });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/structured/stats", async (_req, res) => {
    try {
      const memory = getMemoryStats();
      const cache = getMemoryCacheMetricsSnapshot();
      const recentReuses = getRecentPatternReuses(12);
      const agents = memory.agents.map((agent) => ({
        ...agent,
        cache: cache[agent.agentName] ?? { hits: 0, misses: 0, hitRate: 0 },
      }));

      res.json({
        summary: memory.summary,
        agents,
        recentReuses,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  router.get("/structured/query", async (req, res) => {
    try {
      const task = typeof req.query.task === "string" ? req.query.task : undefined;
      const agentName = typeof req.query.agentName === "string" ? req.query.agentName : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
      const results = queryMemory({ agentName, task, limit });
      res.json({ results, total: results.length });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  router.post("/structured/purge", async (req, res) => {
    try {
      const minConfidence = typeof req.body?.minConfidence === "number" ? req.body.minConfidence : undefined;
      const removed = purgeExpired(minConfidence);
      res.json({ success: true, removed });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  router.get("/structured/export", async (req, res) => {
    try {
      const format = req.query.format === "json" ? "json" : "jsonl";
      const content = exportStructuredMemories(format);
      res.type(format === "json" ? "application/json" : "text/plain").send(content);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  router.post("/structured/golden/sync", async (_req, res) => {
    try {
      const result = await syncLocalToD1();
      res.json({ success: true, ...result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  router.get("/structured/golden/export", async (req, res) => {
    try {
      const format = req.query.format === "json" ? "json" : "jsonl";
      const content = exportGoldenDataset(format);
      res.type(format === "json" ? "application/json" : "text/plain").send(content);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/memory/golden
   * Manually save a golden sample
   */
  router.post("/golden", async (req, res) => {
    try {
      const { source, input, output, prompt, completion, quality } =
        req.body as {
          source?: string;
          input?: string;
          output?: string;
          prompt?: string;
          completion?: string;
          quality?: number;
        };

      const normalizedPrompt = prompt ?? input;
      const normalizedCompletion = completion ?? output;

      if (!source || !normalizedPrompt || !normalizedCompletion) {
        res.status(400).json({
          error: "source and (prompt+completion or input+output) are required",
        });
        return;
      }

      const normalizedQuality =
        typeof quality === "number"
          ? quality > 1
            ? quality / 100
            : quality
          : 1.0;

      // Delegate to Python incubator
      const pythonBaseUrl =
        process.env.PYTHON_SUBSET_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${pythonBaseUrl}/incubator/gold-sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          prompt: normalizedPrompt,
          completion: normalizedCompletion,
          quality: normalizedQuality,
        }),
      });

      if (!response.ok) {
        throw new Error(`Python API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      socketService.emit("gold:golden_saved", {
        source,
        quality: normalizedQuality,
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true, data });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/memory/index-status
   * Get codebase indexing status
   */
  router.get("/index-status", async (_req, res) => {
    try {
      const stats = getIndexStatus(); // Sync function
      res.json(stats);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/memory/reindex
   * Trigger incremental reindex
   */
  router.post("/reindex", async (_req, res) => {
    try {
      await scheduleReindex();
      socketService.emit("gold:reindex_started", {
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true, message: "Reindex scheduled" });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/memory/train
   * Trigger nightly training (delegate to Python or schedule script)
   */
  router.post("/train", async (_req, res) => {
    try {
      // In production, this would trigger the PowerShell script or Python training pipeline
      res.json({
        success: true,
        message: "Training scheduled (not implemented in API yet)",
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
