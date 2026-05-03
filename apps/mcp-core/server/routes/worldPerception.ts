import { Router } from 'express';

import {
  getWorldPerceptionOverview,
  ignoreWorldSignal,
  ingestWorldSignal,
  listWorldSignals,
  promoteWorldSignal,
  runWorldPerceptionCycle,
} from '@packages/core-logic/worldPerceptionLayer.js';
import type {
  WorldPerceptionSourceType,
  WorldPerceptionSignalStatus,
} from '@packages/core-logic/worldPerceptionLayer.js';
import type { IntelligenceBiasLabel, IntelligenceDomain, IntelligenceStance } from '@packages/core-logic/intelligenceMonitor.js';

const STATUSES = new Set<WorldPerceptionSignalStatus>(['detected', 'promoted', 'ignored']);
const SOURCE_TYPES = new Set<WorldPerceptionSourceType>(['manual', 'knowledge_card']);
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

function readTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value.map((entry) => readString(entry)).filter((entry): entry is string => entry !== null);
  return tags.length > 0 ? tags : undefined;
}

function readStatuses(value: unknown): WorldPerceptionSignalStatus[] | undefined {
  if (typeof value !== 'string') return undefined;
  const statuses = value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is WorldPerceptionSignalStatus => STATUSES.has(part as WorldPerceptionSignalStatus));
  return statuses.length > 0 ? statuses : undefined;
}

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
      const limit = readLimit(req.query.limit, 25);
      const status = readStatuses(req.query.status);
      const signals = listWorldSignals({ limit, status });
      res.json({ success: true, count: signals.length, data: signals });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/observe', (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const source = readString(body.source);
      const title = readString(body.title);
      const summary = readString(body.summary);
      const domain = readString(body.domain);
      const provenance = readString(body.provenance);
      const sourceType = readString(body.sourceType) ?? 'manual';
      const biasLabel = readString(body.biasLabel) ?? 'unknown';
      const confidence = readConfidence(body.confidence);

      if (!source || !title || !summary || !domain || !DOMAINS.has(domain as IntelligenceDomain) || !provenance) {
        res.status(400).json({ success: false, error: 'Missing required world perception fields' });
        return;
      }

      if (!SOURCE_TYPES.has(sourceType as WorldPerceptionSourceType)) {
        res.status(400).json({ success: false, error: 'sourceType must be manual or knowledge_card' });
        return;
      }

      if (!BIAS_LABELS.has(biasLabel as IntelligenceBiasLabel)) {
        res.status(400).json({ success: false, error: 'biasLabel must be low, medium, high, or unknown' });
        return;
      }

      if (confidence === null) {
        res.status(400).json({ success: false, error: 'confidence must be a number between 0 and 1' });
        return;
      }

      const signal = ingestWorldSignal({
        sourceType: sourceType as WorldPerceptionSourceType,
        sourceRef: readString(body.sourceRef) ?? undefined,
        source,
        title,
        summary,
        domain: domain as IntelligenceDomain,
        provenance,
        biasLabel: biasLabel as IntelligenceBiasLabel,
        tags: readTags(body.tags),
        entity: readString(body.entity) ?? undefined,
        relation: readString(body.relation) ?? undefined,
        stance: STANCES.has(readString(body.stance) as IntelligenceStance) ? readString(body.stance) as IntelligenceStance : undefined,
        confidence,
        observedAt: readString(body.observedAt) ?? undefined,
      });

      res.json({ success: true, data: signal });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/cycle', (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const limit = body.limit === undefined ? undefined : readLimit(body.limit, 10);
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
        reviewer: isRecord(req.body) ? readString(req.body.reviewer) ?? undefined : undefined,
        note: isRecord(req.body) ? readString(req.body.note) ?? undefined : undefined,
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
        reviewer: isRecord(req.body) ? readString(req.body.reviewer) ?? undefined : undefined,
        note: isRecord(req.body) ? readString(req.body.note) ?? undefined : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  return router;
}
