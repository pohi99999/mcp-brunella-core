import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLearningLoopRouter } from '@apps/mcp-core/server/routes/learningLoop.js';

const learningLoopMocks = vi.hoisted(() => ({
  getLearningLoopOverview: vi.fn(),
  createCuratedSnapshot: vi.fn(),
  runNightlyTraining: vi.fn(),
  runEvalHarness: vi.fn(),
  executeLearningLoopCycle: vi.fn(),
  promoteLearningLoopModel: vi.fn(),
  rollbackLearningLoopModel: vi.fn(),
  captureCuratedGoldenCandidate: vi.fn(),
  captureToolRunCandidates: vi.fn(),
  getCuratedGoldenStats: vi.fn(),
  listCuratedGoldenSamples: vi.fn(),
  reviewCuratedGoldenSample: vi.fn(),
  getReflexRegistrySummary: vi.fn(),
  listEvalResults: vi.fn(),
  listReflexModels: vi.fn(),
  listTrainingRuns: vi.fn(),
}));

vi.mock('@packages/core-logic/goldenDatasetBridge.js', () => ({
  captureCuratedGoldenCandidate: learningLoopMocks.captureCuratedGoldenCandidate,
  captureToolRunCandidates: learningLoopMocks.captureToolRunCandidates,
  getCuratedGoldenStats: learningLoopMocks.getCuratedGoldenStats,
  listCuratedGoldenSamples: learningLoopMocks.listCuratedGoldenSamples,
  reviewCuratedGoldenSample: learningLoopMocks.reviewCuratedGoldenSample,
}));

vi.mock('@packages/core-logic/learningLoopService.js', () => ({
  createCuratedSnapshot: learningLoopMocks.createCuratedSnapshot,
  executeLearningLoopCycle: learningLoopMocks.executeLearningLoopCycle,
  getLearningLoopOverview: learningLoopMocks.getLearningLoopOverview,
  promoteLearningLoopModel: learningLoopMocks.promoteLearningLoopModel,
  rollbackLearningLoopModel: learningLoopMocks.rollbackLearningLoopModel,
  runEvalHarness: learningLoopMocks.runEvalHarness,
  runNightlyTraining: learningLoopMocks.runNightlyTraining,
}));

vi.mock('@packages/core-logic/reflexModelRegistry.js', () => ({
  getReflexRegistrySummary: learningLoopMocks.getReflexRegistrySummary,
  listEvalResults: learningLoopMocks.listEvalResults,
  listReflexModels: learningLoopMocks.listReflexModels,
  listTrainingRuns: learningLoopMocks.listTrainingRuns,
}));

describe('Learning Loop routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();

    learningLoopMocks.getLearningLoopOverview.mockResolvedValue({
      curatedStats: {
        totalCandidates: 6,
        approvedCount: 3,
        rejectedCount: 1,
        pendingReview: 2,
        avgQuality: 0.82,
      },
      registry: {
        activeModel: null,
        shadowModels: [],
        candidateModels: [],
        retiredModels: [],
        latestTrainingRuns: [],
        latestEvalResults: [],
      },
      latestTrainingRuns: [],
      activeReflexModel: null,
    });
    learningLoopMocks.listReflexModels.mockReturnValue([]);
    learningLoopMocks.listTrainingRuns.mockReturnValue([]);
    learningLoopMocks.listEvalResults.mockReturnValue([]);
    learningLoopMocks.getReflexRegistrySummary.mockReturnValue({
      activeModel: null,
      shadowModels: [],
      candidateModels: [],
      retiredModels: [],
      latestTrainingRuns: [],
      latestEvalResults: [],
    });
    learningLoopMocks.listCuratedGoldenSamples.mockReturnValue([]);
    learningLoopMocks.getCuratedGoldenStats.mockReturnValue({
      totalCandidates: 6,
      approvedCount: 3,
      rejectedCount: 1,
      pendingReview: 2,
      avgQuality: 0.82,
    });
    learningLoopMocks.captureToolRunCandidates.mockReturnValue([]);
    learningLoopMocks.captureCuratedGoldenCandidate.mockReturnValue({ success: true, data: { id: 'sample-1' } });
    learningLoopMocks.createCuratedSnapshot.mockResolvedValue({ snapshotId: 'snapshot-1' });
    learningLoopMocks.runNightlyTraining.mockResolvedValue({ trainingRun: { runId: 'train-1' } });
    learningLoopMocks.runEvalHarness.mockResolvedValue({ evalResult: { resultId: 'eval-1' } });
    learningLoopMocks.executeLearningLoopCycle.mockResolvedValue({ promotedModel: null });
    learningLoopMocks.promoteLearningLoopModel.mockReturnValue({ modelId: 'reflex-1', state: 'active' });
    learningLoopMocks.rollbackLearningLoopModel.mockReturnValue({ modelId: 'reflex-shadow-1', state: 'active' });
    learningLoopMocks.reviewCuratedGoldenSample.mockReturnValue({ id: 'sample-1', approvalState: 'approved' });

    app = express();
    app.use(express.json());
    app.use('/api/v1/learning-loop', createLearningLoopRouter());
  });

  it('returns the learning loop overview', async () => {
    const response = await request(app).get('/api/v1/learning-loop/overview');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(learningLoopMocks.getLearningLoopOverview).toHaveBeenCalledOnce();
    expect(response.body.data.curatedStats.approvedCount).toBe(3);
  });

  it('passes trainer options through the train endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/learning-loop/train')
      .send({ dryRun: false, modelName: 'brunella-reflex' });

    expect(response.status).toBe(200);
    expect(learningLoopMocks.runNightlyTraining).toHaveBeenCalledWith({
      dryRun: false,
      modelName: 'brunella-reflex',
    });
  });

  it('passes cycle options through the cycle endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/learning-loop/cycle')
      .send({ dryRun: 'false', promotePassed: 'true', baselineModel: 'qwen2.5-coder:7b' });

    expect(response.status).toBe(200);
    expect(learningLoopMocks.executeLearningLoopCycle).toHaveBeenCalledWith({
      dryRun: false,
      promotePassed: true,
      baselineModel: 'qwen2.5-coder:7b',
    });
  });

  it('rejects invalid curated review decisions', async () => {
    const response = await request(app)
      .post('/api/v1/learning-loop/curated/review/sample-1')
      .send({ decision: 'maybe' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(learningLoopMocks.reviewCuratedGoldenSample).not.toHaveBeenCalled();
  });

  it('returns 404 when a curated sample review target is missing', async () => {
    learningLoopMocks.reviewCuratedGoldenSample.mockReturnValueOnce(null);

    const response = await request(app)
      .post('/api/v1/learning-loop/curated/review/missing-sample')
      .send({ decision: 'approved', reviewer: 'tester' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('promotes a reflex model through the route', async () => {
    const response = await request(app).post('/api/v1/learning-loop/models/reflex-1/promote').send({});

    expect(response.status).toBe(200);
    expect(learningLoopMocks.promoteLearningLoopModel).toHaveBeenCalledWith('reflex-1');
    expect(response.body.data.state).toBe('active');
  });

  it('rolls back a reflex model through the route', async () => {
    const response = await request(app)
      .post('/api/v1/learning-loop/rollback')
      .send({ targetModelId: 'reflex-shadow-1', reason: 'manual rollback' });

    expect(response.status).toBe(200);
    expect(learningLoopMocks.rollbackLearningLoopModel).toHaveBeenCalledWith('reflex-shadow-1', 'manual rollback');
    expect(response.body.data.modelId).toBe('reflex-shadow-1');
  });
});
