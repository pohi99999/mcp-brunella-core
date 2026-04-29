/**
 * Golden Dataset API routes — tool-run analytics and fine-tuning export.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { queryToolRuns, getToolRunStats } from '@packages/utils/globalDb.js';
import type { ToolRunQuery } from '@packages/utils/globalDb.js';

export function createGoldenDatasetRouter(): Router {
  const router = Router();

  /**
   * GET /api/v1/golden-dataset/tool-runs
   * List recent tool runs with optional filters & pagination.
   */
  router.get(
    '/tool-runs',
    asyncHandler(async (req, res) => {
      const query: ToolRunQuery = {
        tool_name: typeof req.query.tool_name === 'string' ? req.query.tool_name : undefined,
        success: req.query.success !== undefined ? Number(req.query.success) : undefined,
        since: typeof req.query.since === 'string' ? req.query.since : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      };

      const rows = queryToolRuns(query);
      res.json({ success: true, count: rows.length, data: rows });
    }),
  );

  /**
   * GET /api/v1/golden-dataset/tool-stats
   * Aggregate stats: total runs, success rate, avg duration per tool.
   */
  router.get(
    '/tool-stats',
    asyncHandler(async (_req, res) => {
      const stats = getToolRunStats();
      res.json({ success: true, data: stats });
    }),
  );

  /**
   * GET /api/v1/golden-dataset/export
   * Export successful tool runs as JSONL for fine-tuning.
   */
  router.get(
    '/export',
    asyncHandler(async (req, res) => {
      const limit = req.query.limit ? Number(req.query.limit) : 1000;
      const rows = queryToolRuns({ success: 1, limit });

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="tool-runs.jsonl"');

      for (const row of rows) {
        const line = JSON.stringify({
          tool: row.tool_name,
          input: row.input_params ? JSON.parse(row.input_params) : null,
          output: row.output_data ? JSON.parse(row.output_data) : null,
          quality: row.quality_score,
          duration_ms: row.duration_ms,
          timestamp: row.timestamp,
        });
        res.write(line + '\n');
      }

      res.end();
    }),
  );

  return router;
}
