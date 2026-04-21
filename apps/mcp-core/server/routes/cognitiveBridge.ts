/**
 * Cognitive Bridge REST API Routes
 * Exposes all 13 BAS intelligence layers to Copilot CLI via HTTP
 */

import { Router } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import {
  enrich,
  reflect,
  getCognitiveStats,
  type EnrichmentRequest,
  type ReflectRequest,
} from '../../core/copilotCognitiveBridge.js';

const MODULE = 'CognitiveBridgeRoute';

export function createCognitiveBridgeRoutes(): Router {
  const router = Router();

  /**
   * POST /enrich — Multi-source context enrichment
   * Body: { query, userId?, agentName?, maxResults? }
   */
  router.post('/enrich', async (req, res) => {
    try {
      const body = req.body as Partial<EnrichmentRequest>;
      if (!body.query || typeof body.query !== 'string') {
        res.status(400).json({ success: false, error: 'query is required (string)' });
        return;
      }
      const result = await enrich({
        query: body.query,
        userId: body.userId,
        agentName: body.agentName,
        maxResults: body.maxResults,
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
      const body = req.body as Partial<ReflectRequest>;
      if (!body.taskId || !body.agentName || !body.task || body.result === undefined || body.success === undefined) {
        res.status(400).json({
          success: false,
          error: 'Required: taskId, agentName, task, result, success'
        });
        return;
      }
      const result = await reflect({
        taskId: body.taskId,
        agentName: body.agentName,
        task: body.task,
        result: body.result,
        success: body.success,
        confidence: body.confidence,
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
      const { layer, query, params } = req.body as { layer?: string; query?: string; params?: Record<string, unknown> };
      if (!layer || !query) {
        res.status(400).json({ success: false, error: 'Required: layer, query' });
        return;
      }

      let result: unknown;
      switch (layer) {
        case 'structured':
          result = (await import('../../core/structuredMemory.js')).queryMemory({
            task: query,
            agentName: params?.agentName as string | undefined,
            limit: (params?.limit as number) ?? 10,
          });
          break;
        case 'graphrag': {
          const gr = (await import('../../core/graphRagEngine.js')).GraphRagEngine.getInstance();
          result = gr.queryContext(query, (params?.maxNodes as number) ?? 10);
          break;
        }
        case 'preferences':
          result = (await import('../../core/userPreferences.js')).queryPreferences({
            user_id: (params?.userId as string) ?? 'default',
            key: query,
            limit: (params?.limit as number) ?? 10,
          });
          break;
        case 'golden':
          result = await (await import('../../core/goldenDatasetBridge.js')).getGoldenStats();
          break;
        default:
          res.status(400).json({ success: false, error: `Unknown layer: ${layer}. Valid: structured, graphrag, preferences, golden` });
          return;
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
