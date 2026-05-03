import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';

import {
  createKnowledgeCard,
  initExternalKnowledgeSchema,
  listGovernanceReviewQueue,
  promoteKnowledgeCard,
  safeIngestWebSource,
  safeIngestYoutubeSource,
  searchKnowledgeCards,
} from '@packages/core-logic/services/externalKnowledgeService.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError, logInfo } from '@packages/utils/logger.js';

const MODULE = 'ExternalKnowledgeRoutes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readLimit(value: unknown, fallback = 20): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => readString(item))
      .filter((item): item is string => item !== undefined);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseClaims(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => readString(item))
      .filter((item): item is string => item !== undefined);
  }
  if (typeof value === 'string') {
    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

export function createExternalKnowledgeRoutes(db: Database.Database): Router {
  initExternalKnowledgeSchema(db);
  const router = Router();

  router.post('/sources/web', async (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const source = await safeIngestWebSource(
        {
          url: readString(body.url) ?? '',
          title: readString(body.title),
          content: readString(body.content),
          author: readString(body.author),
          publishedAt: readString(body.publishedAt),
          language: readString(body.language),
          tags: parseTags(body.tags),
        },
        { db },
      );

      res.status(201).json({ success: true, source });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `POST /sources/web failed: ${normalized.message}`);
      res.status(400).json({ success: false, error: normalized.message });
    }
  });

  router.post('/sources/youtube', async (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const source = await safeIngestYoutubeSource(
        {
          url: readString(body.url) ?? '',
          title: readString(body.title),
          transcript: readString(body.transcript) ?? '',
          channel: readString(body.channel),
          publishedAt: readString(body.publishedAt),
          language: readString(body.language),
          tags: parseTags(body.tags),
        },
        { db },
      );

      res.status(201).json({ success: true, source });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `POST /sources/youtube failed: ${normalized.message}`);
      res.status(400).json({ success: false, error: normalized.message });
    }
  });

  router.post('/cards', (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const card = createKnowledgeCard(
        {
          sourceIds: Array.isArray(body.sourceIds)
            ? body.sourceIds.map((item: unknown) => readString(item)).filter((item): item is string => item !== undefined)
            : [],
          title: readString(body.title),
          summary: readString(body.summary) ?? '',
          claims: parseClaims(body.claims),
          evidence: parseClaims(body.evidence),
          tags: parseTags(body.tags),
          entities: parseClaims(body.entities),
          scores: isRecord(body.scores) ? body.scores : undefined,
          confidence: typeof body.confidence === 'number' && Number.isFinite(body.confidence) ? body.confidence : undefined,
        },
        { db },
      );

      res.status(201).json({ success: true, card });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `POST /cards failed: ${normalized.message}`);
      res.status(400).json({ success: false, error: normalized.message });
    }
  });

  router.get('/review-queue', (req: Request, res: Response) => {
    try {
      const limit = readLimit(req.query.limit, 20);
      const items = listGovernanceReviewQueue({ db, limit });
      res.json({ success: true, items, count: items.length });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `GET /review-queue failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/cards/:cardId/promote', async (req: Request, res: Response) => {
    try {
      const cardId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
      const body = isRecord(req.body) ? req.body : {};
      const card = await promoteKnowledgeCard(cardId, {
        db,
        reviewer: readString(body.reviewer) ?? '',
        note: readString(body.note),
      });

      res.json({ success: true, card });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `POST /cards/:cardId/promote failed: ${normalized.message}`);
      res.status(400).json({ success: false, error: normalized.message });
    }
  });

  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = readString(req.query.query) ?? '';
      const limit = readLimit(req.query.limit, 20);
      const includeProvisional = parseBoolean(req.query.includeProvisional);
      const results = await searchKnowledgeCards({ query, limit, includeProvisional }, { db });
      res.json({ success: true, results, count: results.length });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `GET /search failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/health', (_req: Request, res: Response) => {
    logInfo(MODULE, 'GET /health');
    res.json({
      success: true,
      policy: {
        stages: ['raw', 'screened', 'provisional', 'canonical', 'deprecated'],
        canonicalOnlyRagIndexing: true,
        singleSourcePromotionRequiresReviewerNote: true,
      },
    });
  });

  return router;
}

