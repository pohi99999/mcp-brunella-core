import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  captureCuratedGoldenCandidate,
  captureToolRunCandidates,
  type CuratedGoldenApprovalState,
  getCuratedGoldenStats,
  listCuratedGoldenSamples,
  reviewCuratedGoldenSample,
} from '../../core/goldenDatasetBridge.js';
import {
  executeLearningLoopCycle,
  createCuratedSnapshot,
  getLearningLoopOverview,
  promoteLearningLoopModel,
  rollbackLearningLoopModel,
  runEvalHarness,
  runNightlyTraining,
} from '../../core/learningLoopService.js';
import {
  getReflexRegistrySummary,
  listEvalResults,
  listReflexModels,
  type ReflexModelState,
  listTrainingRuns,
} from '../../core/reflexModelRegistry.js';

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
    res.json({ success: true, data: listReflexModels(state as ReflexModelState | undefined, limit) });
  }));

  router.get('/training-runs', asyncHandler(async (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    res.json({ success: true, data: listTrainingRuns(limit) });
  }));

  router.get('/eval-results', asyncHandler(async (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    res.json({ success: true, data: listEvalResults(limit) });
  }));

  router.get('/curated/stats', asyncHandler(async (_req, res) => {
    res.json({ success: true, data: getCuratedGoldenStats() });
  }));

  router.get('/curated/samples', asyncHandler(async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
    const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
    const data = listCuratedGoldenSamples({ state: state as CuratedGoldenApprovalState | undefined, limit, offset });
    res.json({ success: true, count: data.length, data });
  }));

  router.post('/curated/capture', asyncHandler(async (req, res) => {
    const result = captureCuratedGoldenCandidate({
      prompt: String(req.body?.prompt ?? ''),
      completion: String(req.body?.completion ?? ''),
      source: String(req.body?.source ?? 'manual'),
      quality: typeof req.body?.quality === 'number' ? req.body.quality : undefined,
      provenance: req.body?.provenance && typeof req.body.provenance === 'object' ? req.body.provenance : undefined,
      autoApprove: parseBoolean(req.body?.autoApprove, false),
    });
    res.status(result.success ? 200 : 400).json(result);
  }));

  router.post('/curated/ingest-tool-runs', asyncHandler(async (req, res) => {
    const limit = typeof req.body?.limit === 'number' ? req.body.limit : 50;
    const results = captureToolRunCandidates(limit);
    res.json({ success: true, count: results.length, data: results });
  }));

  router.post('/curated/review/:sampleId', asyncHandler(async (req, res) => {
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ success: false, error: 'decision must be approved or rejected' });
      return;
    }
    const sample = reviewCuratedGoldenSample(
      String(req.params.sampleId),
      decision,
      String(req.body?.reviewer ?? 'manual'),
      typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    );
    if (!sample) {
      res.status(404).json({ success: false, error: 'sample not found' });
      return;
    }
    res.json({ success: true, data: sample });
  }));

  router.post('/snapshot', asyncHandler(async (req, res) => {
    const minQuality = typeof req.body?.minQuality === 'number' ? req.body.minQuality : 0.7;
    const snapshot = await createCuratedSnapshot(minQuality);
    res.json({ success: true, data: snapshot });
  }));

  router.post('/train', asyncHandler(async (req, res) => {
    const dryRun = parseBoolean(req.body?.dryRun, true);
    const modelName = typeof req.body?.modelName === 'string' ? req.body.modelName : undefined;
    const data = await runNightlyTraining({ dryRun, modelName });
    res.json({ success: true, data });
  }));

  router.post('/evaluate', asyncHandler(async (req, res) => {
    const modelId = typeof req.body?.modelId === 'string' ? req.body.modelId : undefined;
    const baselineModel = typeof req.body?.baselineModel === 'string' ? req.body.baselineModel : undefined;
    const data = await runEvalHarness({ modelId, baselineModel });
    res.json({ success: true, data });
  }));

  router.post('/cycle', asyncHandler(async (req, res) => {
    const dryRun = parseBoolean(req.body?.dryRun, true);
    const promotePassed = parseBoolean(req.body?.promotePassed, false);
    const baselineModel = typeof req.body?.baselineModel === 'string' ? req.body.baselineModel : undefined;
    const data = await executeLearningLoopCycle({ dryRun, promotePassed, baselineModel });
    res.json({ success: true, data });
  }));

  router.post('/models/:modelId/promote', asyncHandler(async (req, res) => {
    const data = promoteLearningLoopModel(String(req.params.modelId));
    res.json({ success: true, data });
  }));

  router.post('/rollback', asyncHandler(async (req, res) => {
    const targetModelId = typeof req.body?.targetModelId === 'string' ? req.body.targetModelId : undefined;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const data = rollbackLearningLoopModel(targetModelId, reason);
    res.json({ success: true, data });
  }));

  return router;
}
