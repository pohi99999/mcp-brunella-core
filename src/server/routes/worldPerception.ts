import { Router } from 'express';

import {
  getWorldPerceptionOverview,
  ignoreWorldSignal,
  ingestWorldSignal,
  listWorldSignals,
  promoteWorldSignal,
  runWorldPerceptionCycle,
} from '../../core/worldPerceptionLayer.js';
import type {
  WorldPerceptionSignalInput,
  WorldPerceptionSignalStatus,
} from '../../core/worldPerceptionLayer.js';

export function createWorldPerceptionRouter(): Router {
  const router = Router();

  router.get('/overview', (_req, res) => {
    try {
      const overview = getWorldPerceptionOverview();
      res.json({ success: true, data: overview });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/signals', (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
      const status = statusRaw
        ? statusRaw
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean) as WorldPerceptionSignalStatus[]
        : undefined;
      const signals = listWorldSignals({ limit, status });
      res.json({ success: true, count: signals.length, data: signals });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/observe', (req, res) => {
    try {
      const body = req.body as Partial<WorldPerceptionSignalInput>;
      if (!body.source || !body.title || !body.summary || !body.domain || !body.provenance) {
        res.status(400).json({ success: false, error: 'Missing required world perception fields' });
        return;
      }

      const signal = ingestWorldSignal({
        sourceType: body.sourceType ?? 'manual',
        sourceRef: body.sourceRef,
        source: body.source,
        title: body.title,
        summary: body.summary,
        domain: body.domain,
        provenance: body.provenance,
        biasLabel: body.biasLabel ?? 'unknown',
        tags: body.tags,
        entity: body.entity,
        relation: body.relation,
        stance: body.stance,
        confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
        observedAt: body.observedAt,
      });

      res.json({ success: true, data: signal });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/cycle', (req, res) => {
    try {
      const limit = typeof req.body?.limit === 'number' ? req.body.limit : undefined;
      const result = runWorldPerceptionCycle(limit);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/signals/:signalId/promote', async (req, res) => {
    try {
      const result = await promoteWorldSignal(req.params.signalId, {
        reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/signals/:signalId/ignore', (req, res) => {
    try {
      const result = ignoreWorldSignal(req.params.signalId, {
        reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  return router;
}
