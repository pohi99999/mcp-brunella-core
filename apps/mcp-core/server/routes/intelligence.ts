import { Router } from 'express';
import { getIntelligenceOverview, ingestSignal, listReviewQueue, listSignals, reviewSignal } from '@packages/core-logic/intelligenceMonitor.js';
import type { IntelligenceBiasLabel, IntelligenceDomain, IntelligenceSignalStatus, IntelligenceStance } from '@packages/core-logic/intelligenceMonitor.js';

const STATUSES = new Set<IntelligenceSignalStatus>(['pending_review', 'approved', 'rejected', 'promoted']);
const DOMAINS = new Set<IntelligenceDomain>(['business', 'social', 'political', 'financial', 'technology']);
const BIAS_LABELS = new Set<IntelligenceBiasLabel>(['low', 'medium', 'high', 'unknown']);
const STANCES = new Set<IntelligenceStance>(['supports', 'contradicts', 'neutral']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readLimit(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function readConfidence(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function readStatuses(value: unknown): IntelligenceSignalStatus[] | undefined {
  if (typeof value !== 'string') return undefined;
  const statuses = value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is IntelligenceSignalStatus => STATUSES.has(part as IntelligenceSignalStatus));
  return statuses.length > 0 ? statuses : undefined;
}

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
      const limit = readLimit(req.query.limit, 25);
      const status = readStatuses(req.query.status);
      const signals = listSignals({ limit, status });
      res.json({ success: true, data: signals });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/review-queue', async (req, res) => {
    try {
      const limit = readLimit(req.query.limit, 10);
      const queue = listReviewQueue(limit);
      res.json({ success: true, data: queue });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/signals', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const sourceClass = readString(body.sourceClass);
      const source = readString(body.source);
      const title = readString(body.title);
      const summary = readString(body.summary);
      const biasLabel = readString(body.biasLabel);
      const provenance = readString(body.provenance);
      const confidence = readConfidence(body.confidence);

      if (!sourceClass || !DOMAINS.has(sourceClass as IntelligenceDomain) || !source || !title || !summary || !biasLabel || !BIAS_LABELS.has(biasLabel as IntelligenceBiasLabel) || !provenance) {
        res.status(400).json({ success: false, error: 'Missing required signal fields' });
        return;
      }

      if (confidence === null) {
        res.status(400).json({ success: false, error: 'confidence must be a number between 0 and 1' });
        return;
      }

      const record = await ingestSignal({
        sourceClass: sourceClass as IntelligenceDomain,
        source,
        title,
        summary,
        entity: readString(body.entity) ?? undefined,
        relation: readString(body.relation) ?? undefined,
        stance: STANCES.has(readString(body.stance) as IntelligenceStance) ? readString(body.stance) as IntelligenceStance : undefined,
        biasLabel: biasLabel as IntelligenceBiasLabel,
        provenance,
        confidence,
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
      const body = isRecord(req.body) ? req.body : {};
      const decision = readString(body.decision) ?? undefined;
      const note = readString(body.note) ?? undefined;

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
