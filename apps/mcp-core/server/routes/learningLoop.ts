import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  captureCuratedGoldenCandidate,
  captureToolRunCandidates,
  type CuratedGoldenApprovalState,
  getCuratedGoldenStats,
  listCuratedGoldenSamples,
  reviewCuratedGoldenSample,
} from '@packages/core-logic/goldenDatasetBridge.js';
import {
  executeLearningLoopCycle,
  createCuratedSnapshot,
  getLearningLoopOverview,
  promoteLearningLoopModel,
  rollbackLearningLoopModel,
  runEvalHarness,
  runNightlyTraining,
} from '@packages/core-logic/learningLoopService.js';
import {
  getReflexRegistrySummary,
  listEvalResults,
  listReflexModels,
  type ReflexModelState,
  listTrainingRuns,
} from '@packages/core-logic/reflexModelRegistry.js';

const REFLEX_MODEL_STATES = new Set<ReflexModelState>(['candidate', 'shadow', 'active', 'retired']);
const CURATED_APPROVAL_STATES = new Set<CuratedGoldenApprovalState>(['pending', 'approved', 'rejected']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readLimit(value: unknown, fallback: number, max = 200): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function readOffset(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

function readRatio(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function readReflexModelState(value: unknown): ReflexModelState | undefined {
  const state = readString(value);
  return state && REFLEX_MODEL_STATES.has(state as ReflexModelState) ? state as ReflexModelState : undefined;
}

function readCuratedApprovalState(value: unknown): CuratedGoldenApprovalState | undefined {
  const state = readString(value);
  return state && CURATED_APPROVAL_STATES.has(state as CuratedGoldenApprovalState) ? state as CuratedGoldenApprovalState : undefined;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return fallback;
}

export function createLearningLoopRouter(): Router {
  const router = Router();

  router.get('/overview', asyncHandler(async (_req, res) => {
    const data = await getLearningLoopOverview();
    res.json({ success: true, data });
  }));

  router.get('/registry', asyncHandler(async (_req, res) => {
    res.json({ success: true, data: getReflexRegistrySummary() });
  }));

  router.get('/models', asyncHandler(async (req, res) => {
    const state = readReflexModelState(req.query.state);
    const limit = readLimit(req.query.limit, 25);
    res.json({ success: true, data: listReflexModels(state, limit) });
  }));

  router.get('/training-runs', asyncHandler(async (req, res) => {
    const limit = readLimit(req.query.limit, 20);
    res.json({ success: true, data: listTrainingRuns(limit) });
  }));

  router.get('/eval-results', asyncHandler(async (req, res) => {
    const limit = readLimit(req.query.limit, 20);
    res.json({ success: true, data: listEvalResults(limit) });
  }));

  router.get('/curated/stats', asyncHandler(async (_req, res) => {
    res.json({ success: true, data: getCuratedGoldenStats() });
  }));

  router.get('/curated/samples', asyncHandler(async (req, res) => {
    const state = readCuratedApprovalState(req.query.state);
    const limit = readLimit(req.query.limit, 100);
    const offset = readOffset(req.query.offset);
    const data = listCuratedGoldenSamples({ state, limit, offset });
    res.json({ success: true, count: data.length, data });
  }));

  router.post('/curated/capture', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const result = captureCuratedGoldenCandidate({
      prompt: readString(body.prompt) ?? '',
      completion: readString(body.completion) ?? '',
      source: readString(body.source) ?? 'manual',
      quality: typeof body.quality === 'number' && Number.isFinite(body.quality) ? readRatio(body.quality, body.quality) : undefined,
      provenance: isRecord(body.provenance) ? body.provenance : undefined,
      autoApprove: parseBoolean(body.autoApprove, false),
    });
    res.status(result.success ? 200 : 400).json(result);
  }));

  router.post('/curated/ingest-tool-runs', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const limit = readLimit(body.limit, 50);
    const results = captureToolRunCandidates(limit);
    res.json({ success: true, count: results.length, data: results });
  }));

  router.post('/curated/review/:sampleId', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const decision = readString(body.decision);
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ success: false, error: 'decision must be approved or rejected' });
      return;
    }
    const sample = reviewCuratedGoldenSample(
      readString(req.params.sampleId) ?? '',
      decision,
      readString(body.reviewer) ?? 'manual',
      readString(body.notes),
    );
    if (!sample) {
      res.status(404).json({ success: false, error: 'sample not found' });
      return;
    }
    res.json({ success: true, data: sample });
  }));

  router.post('/snapshot', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const minQuality = readRatio(body.minQuality, 0.7);
    const snapshot = await createCuratedSnapshot(minQuality);
    res.json({ success: true, data: snapshot });
  }));

  router.post('/train', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const dryRun = parseBoolean(body.dryRun, true);
    const modelName = readString(body.modelName);
    const data = await runNightlyTraining({ dryRun, modelName });
    res.json({ success: true, data });
  }));

  router.post('/evaluate', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const modelId = readString(body.modelId);
    const baselineModel = readString(body.baselineModel);
    const data = await runEvalHarness({ modelId, baselineModel });
    res.json({ success: true, data });
  }));

  router.post('/cycle', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const dryRun = parseBoolean(body.dryRun, true);
    const promotePassed = parseBoolean(body.promotePassed, false);
    const baselineModel = readString(body.baselineModel);
    const data = await executeLearningLoopCycle({ dryRun, promotePassed, baselineModel });
    res.json({ success: true, data });
  }));

  router.post('/models/:modelId/promote', asyncHandler(async (req, res) => {
    const data = promoteLearningLoopModel(readString(req.params.modelId) ?? '');
    res.json({ success: true, data });
  }));

  router.post('/rollback', asyncHandler(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const targetModelId = readString(body.targetModelId);
    const reason = readString(body.reason);
    const data = rollbackLearningLoopModel(targetModelId, reason);
    res.json({ success: true, data });
  }));

  return router;
}
