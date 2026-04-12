import { Router } from 'express';

import type Database from 'better-sqlite3';

import {
  createKnowledgeCard,
  initExternalKnowledgeSchema,
  listGovernanceReviewQueue,
  promoteKnowledgeCard,
  safeIngestWebSource,
  safeIngestYoutubeSource,
  searchKnowledgeCards,
} from '../services/externalKnowledgeService.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';

const MODULE = 'ExternalKnowledgeRoutes';

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseClaims(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
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

  router.post('/sources/web', async (req: any, res: any) => {
    try {
      const source = await safeIngestWebSource(
        {
          url: String(req.body?.url ?? ''),
          title: typeof req.body?.title === 'string' ? req.body.title : undefined,
          content: typeof req.body?.content === 'string' ? req.body.content : undefined,
          author: typeof req.body?.author === 'string' ? req.body.author : undefined,
          publishedAt: typeof req.body?.publishedAt === 'string' ? req.body.publishedAt : undefined,
          language: typeof req.body?.language === 'string' ? req.body.language : undefined,
          tags: parseTags(req.body?.tags),
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

  router.post('/sources/youtube', async (req: any, res: any) => {
    try {
      const source = await safeIngestYoutubeSource(
        {
          url: String(req.body?.url ?? ''),
          title: typeof req.body?.title === 'string' ? req.body.title : undefined,
          transcript: String(req.body?.transcript ?? ''),
          channel: typeof req.body?.channel === 'string' ? req.body.channel : undefined,
          publishedAt: typeof req.body?.publishedAt === 'string' ? req.body.publishedAt : undefined,
          language: typeof req.body?.language === 'string' ? req.body.language : undefined,
          tags: parseTags(req.body?.tags),
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

  router.post('/cards', (req: any, res: any) => {
    try {
      const card = createKnowledgeCard(
        {
          sourceIds: Array.isArray(req.body?.sourceIds) ? req.body.sourceIds.map((item: unknown) => String(item)) : [],
          title: typeof req.body?.title === 'string' ? req.body.title : undefined,
          summary: String(req.body?.summary ?? ''),
          claims: parseClaims(req.body?.claims),
          evidence: parseClaims(req.body?.evidence),
          tags: parseTags(req.body?.tags),
          entities: parseClaims(req.body?.entities),
          scores: typeof req.body?.scores === 'object' && req.body?.scores !== null ? req.body.scores : undefined,
          confidence: typeof req.body?.confidence === 'number' ? req.body.confidence : undefined,
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

  router.get('/review-queue', (req: any, res: any) => {
    try {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const items = listGovernanceReviewQueue({ db, limit });
      res.json({ success: true, items, count: items.length });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `GET /review-queue failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/cards/:cardId/promote', async (req: any, res: any) => {
    try {
      const cardId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
      const card = await promoteKnowledgeCard(cardId, {
        db,
        reviewer: String(req.body?.reviewer ?? ''),
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });

      res.json({ success: true, card });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `POST /cards/:cardId/promote failed: ${normalized.message}`);
      res.status(400).json({ success: false, error: normalized.message });
    }
  });

  router.get('/search', async (req: any, res: any) => {
    try {
      const query = typeof req.query.query === 'string' ? req.query.query : '';
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const includeProvisional = parseBoolean(req.query.includeProvisional);
      const results = await searchKnowledgeCards({ query, limit, includeProvisional }, { db });
      res.json({ success: true, results, count: results.length });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(MODULE, `GET /search failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/health', (_req: any, res: any) => {
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
