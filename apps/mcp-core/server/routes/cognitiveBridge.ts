/**
 * Cognitive Bridge REST API Routes
 * Exposes all 13 BAS intelligence layers to Copilot CLI via HTTP
 */

import { Router } from 'express';
import { logInfo, logError } from '@packages/utils/logger.js';
import {
  enrich,
  reflect,
  getCognitiveStats,
} from '@packages/core-logic/copilotCognitiveBridge.js';

const MODULE = 'CognitiveBridgeRoute';
const QUERY_LAYERS = new Set(['structured', 'graphrag', 'preferences', 'golden']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalString(value: unknown): string | undefined {
  return readString(value) ?? undefined;
}

function readPositiveInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function readConfidence(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

export function createCognitiveBridgeRoutes(): Router {
  const router = Router();

  /**
   * POST /enrich — Multi-source context enrichment
   * Body: { query, userId?, agentName?, maxResults? }
   */
  router.post('/enrich', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const query = readString(body.query);
      if (!query) {
        res.status(400).json({ success: false, error: 'query is required (string)' });
        return;
      }
      const result = await enrich({
        query,
        userId: readOptionalString(body.userId),
        agentName: readOptionalString(body.agentName),
        maxResults: readPositiveInteger(body.maxResults, 5, 50),
      });
      logInfo(MODULE, `Enrichment: ${result.layers.filter(l => l.status === 'ok').length} layers OK (${result.processingTimeMs}ms)`);
      res.json({ success: true, data: result });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(MODULE, `Enrich failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * POST /reflect — Post-task learning loop
   * Body: { taskId, agentName, task, result, success, confidence? }
   */
  router.post('/reflect', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const taskId = readString(body.taskId);
      const agentName = readString(body.agentName);
      const task = readString(body.task);
      const resultText = readString(body.result);
      const confidence = readConfidence(body.confidence);

      if (!taskId || !agentName || !task || !resultText || typeof body.success !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Required: taskId, agentName, task, result, success'
        });
        return;
      }

      if (confidence === null) {
        res.status(400).json({ success: false, error: 'confidence must be a number between 0 and 1' });
        return;
      }

      const result = await reflect({
        taskId,
        agentName,
        task,
        result: resultText,
        success: body.success,
        confidence,
      });
      logInfo(MODULE, `Reflection stored in ${result.layers.length} layers`);
      res.json({ success: true, data: result });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(MODULE, `Reflect failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /stats — Aggregate statistics from all cognitive layers
   */
  router.get('/stats', async (_req, res) => {
    try {
      const stats = await getCognitiveStats();
      res.json({ success: true, data: stats });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(MODULE, `Stats failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * POST /query — Query specific memory layer
   * Body: { layer, query, params? }
   */
  router.post('/query', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const layer = readString(body.layer);
      const query = readString(body.query);
      const params = isRecord(body.params) ? body.params : {};
      if (!layer || !query) {
        res.status(400).json({ success: false, error: 'Required: layer, query' });
        return;
      }

      if (!QUERY_LAYERS.has(layer)) {
        res.status(400).json({ success: false, error: `Unknown layer: ${layer}. Valid: structured, graphrag, preferences, golden` });
        return;
      }

      let result: unknown;
      switch (layer) {
        case 'structured':
          result = (await import('@packages/core-logic/structuredMemory.js')).queryMemory({
            task: query,
            agentName: readOptionalString(params.agentName),
            limit: readPositiveInteger(params.limit, 10, 50),
          });
          break;
        case 'graphrag': {
          const gr = (await import('@packages/core-logic/graphRagEngine.js')).GraphRagEngine.getInstance();
          result = gr.queryContext(query, readPositiveInteger(params.maxNodes, 10, 50));
          break;
        }
        case 'preferences':
          result = (await import('@packages/core-logic/userPreferences.js')).queryPreferences({
            user_id: readString(params.userId) ?? 'default',
            key: query,
            limit: readPositiveInteger(params.limit, 10, 50),
          });
          break;
        case 'golden':
          result = await (await import('@packages/core-logic/goldenDatasetBridge.js')).getGoldenStats();
          break;
      }

      res.json({ success: true, layer, data: result });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(MODULE, `Query failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /health — Quick health check of all layers
   */
  router.get('/health', async (_req, res) => {
    try {
      const stats = await getCognitiveStats();
      const healthy = stats.activeLayers >= 3;
      res.status(healthy ? 200 : 503).json({
        healthy,
        activeLayers: stats.activeLayers,
        totalLayers: stats.totalLayers,
        timestamp: stats.timestamp,
      });
    } catch (e: unknown) {
      res.status(503).json({ healthy: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
