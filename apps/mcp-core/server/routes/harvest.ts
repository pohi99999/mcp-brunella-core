import { Router } from 'express';
import { logInfo, logError } from '@packages/utils/logger.js';

const harvestRouter = Router();

// In-memory last harvest state (per process)
let lastHarvestTime: number | null = null;
let lastHarvestStats: { sources: number; items: number } = { sources: 0, items: 0 };

// POST /api/v1/harvest/sync
// Receives harvest data from CEAN Worker
// Body: { source: string; items: Array<{ title: string; summary: string }> }
harvestRouter.post('/sync', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const source = typeof body.source === 'string' ? body.source : 'unknown';
  const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];

  lastHarvestTime = Date.now();
  lastHarvestStats = { sources: lastHarvestStats.sources + 1, items: lastHarvestStats.items + items.length };

  logInfo('HarvestSync', `Received ${items.length} items from ${source}`);

  return res.json({ success: true, received: items.length, source });
});

// GET /api/v1/harvest/status
// Returns last harvest time and stats
harvestRouter.get('/status', (_req, res) => {
  return res.json({
    lastHarvestTime,
    lastHarvestTimeISO: lastHarvestTime ? new Date(lastHarvestTime).toISOString() : null,
    stats: lastHarvestStats,
  });
});

export { harvestRouter };
