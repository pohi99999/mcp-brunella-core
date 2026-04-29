import { Router } from 'express';
import { getIntelligenceOverview, ingestSignal, listReviewQueue, listSignals, reviewSignal } from '@packages/core-logic/intelligenceMonitor.js';
import type { IntelligenceSignalInput, IntelligenceSignalStatus } from '@packages/core-logic/intelligenceMonitor.js';

export function createIntelligenceRouter(): Router {
  const router = Router();

  router.get('/overview', async (_req, res) => {
    try {
      const overview = await getIntelligenceOverview();
      res.json({ success: true, data: overview });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/signals', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
      const status = statusRaw ? statusRaw.split(',').map((part) => part.trim()).filter(Boolean) as IntelligenceSignalStatus[] : undefined;
      const signals = listSignals({ limit, status });
      res.json({ success: true, data: signals });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/review-queue', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const queue = listReviewQueue(limit);
      res.json({ success: true, data: queue });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/signals', async (req, res) => {
    try {
      const body = req.body as Partial<IntelligenceSignalInput>;
      if (!body.sourceClass || !body.source || !body.title || !body.summary || !body.biasLabel || !body.provenance) {
        res.status(400).json({ success: false, error: 'Missing required signal fields' });
        return;
      }

      const record = await ingestSignal({
        sourceClass: body.sourceClass,
        source: body.source,
        title: body.title,
        summary: body.summary,
        entity: body.entity,
        relation: body.relation,
        stance: body.stance,
        biasLabel: body.biasLabel,
        provenance: body.provenance,
        confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
      });

      res.json({ success: true, data: record });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/review/:signalId', async (req, res) => {
    try {
      const signalId = req.params.signalId;
      const decision = typeof req.body?.decision === 'string' ? req.body.decision : undefined;
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

      if (decision !== 'approve' && decision !== 'reject') {
        res.status(400).json({ success: false, error: 'decision must be approve or reject' });
        return;
      }

      const record = await reviewSignal(signalId, decision, note);
      res.json({ success: true, data: record });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
