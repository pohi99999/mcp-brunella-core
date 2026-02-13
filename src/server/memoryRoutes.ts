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
import { getGoldenStats } from "../core/goldenDatasetBridge.js";
import { getIndexStatus, scheduleReindex } from "../core/codebaseIndexer.js";
import { socketService } from "./SocketService.js";
import fetch from "node-fetch";

export function createMemoryRouter(): Router {
  const router = Router();

  /**
   * GET /api/memory/stats
   * Get golden dataset + index statistics
   */
  router.get("/stats", async (_req, res) => {
    try {
      const golden = await getGoldenStats();
      const index = getIndexStatus(); // Already sync, returns status object

      res.json({ golden, index });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
