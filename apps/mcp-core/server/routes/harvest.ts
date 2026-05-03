import { Router } from 'express';
import { logInfo, logError } from '@packages/utils/logger.js';

const harvestRouter = Router();

// In-memory last harvest state (per process)
let lastHarvestTime: number | null = null;
let lastHarvestStats: { sources: number; items: number } = { sources: 0, items: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

// POST /api/v1/harvest/sync
// Receives harvest data from CEAN Worker
// Body: { source: string; items: Array<{ title: string; summary: string }> }
harvestRouter.post('/sync', async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const source = readString(body.source, 'unknown');
  const items = Array.isArray(body.items)
    ? body.items.filter(isRecord)
    : [];

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
