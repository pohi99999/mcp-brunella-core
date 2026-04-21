import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DecisionResult, DecisionStats } from '../src/core/decisionTypes.js';

const predictiveHarness = vi.hoisted(() => ({
  getDecisionHistory: vi.fn(),
  getDecisionStats: vi.fn(),
  analyzeDecisionPoint: vi.fn(),
  getDecisionResult: vi.fn(),
  rollbackDecision: vi.fn(),
}));

vi.mock('../src/core/predictiveDecisionEngine.js', () => ({
  predictiveDecisionEngine: {
    getDecisionHistory: predictiveHarness.getDecisionHistory,
    getDecisionStats: predictiveHarness.getDecisionStats,
    analyzeDecisionPoint: predictiveHarness.analyzeDecisionPoint,
    getDecisionResult: predictiveHarness.getDecisionResult,
    rollbackDecision: predictiveHarness.rollbackDecision,
  },
}));

import { createPredictiveDecisionRouter } from '../src/server/routes/predictiveDecision.js';

function makeDecisionResult(overrides: Partial<DecisionResult> = {}): DecisionResult {
  return {
    id: 'pdr-1',
    triggeredBy: 'manual_api',
    scenarios: [],
    selectedScenario: null,
    executedAction: null,
    rollbackCapability: false,
    outcome: 'no_action',
    createdAt: '2026-04-11T16:00:00.000Z',
    rolledBackAt: null,
    metadata: {
      activeAlerts: 1,
      signalCount: 2,
      reviewQueueCount: 0,
      activeGoals: 1,
      config: {
        scenarioCount: 12,
        riskWeight: 0.3,
        impactWeight: 0.4,
        alignmentWeight: 0.3,
        selectionThreshold: 0.58,
      },
    },
    ...overrides,
  };
}

describe('PredictiveDecision route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/predictive-decision', createPredictiveDecisionRouter());

  beforeEach(() => {
    vi.clearAllMocks();
    predictiveHarness.getDecisionHistory.mockReturnValue([makeDecisionResult()]);
    predictiveHarness.getDecisionStats.mockReturnValue({
      totalDecisions: 3,
      actionsExecuted: 1,
      noActionDecisions: 1,
      failedActions: 0,
      rolledBackActions: 1,
      successRate: 1 / 3,
      averageScenarioCount: 8,
      averageSelectedScore: 0.712,
      actionBreakdown: [{ actionType: 'create_goal', count: 2 }],
      dateRange: {
        from: '2026-03-12T00:00:00.000Z',
        to: '2026-04-11T00:00:00.000Z',
      },
    } satisfies DecisionStats);
    predictiveHarness.analyzeDecisionPoint.mockResolvedValue(makeDecisionResult({
      outcome: 'executed',
      rollbackCapability: true,
    }));
    predictiveHarness.getDecisionResult.mockReturnValue(makeDecisionResult());
    predictiveHarness.rollbackDecision.mockResolvedValue(makeDecisionResult({
      outcome: 'rolled_back',
      rolledBackAt: '2026-04-11T16:05:00.000Z',
    }));
  });

  it('returns decision history', async () => {
    const response = await request(app).get('/api/v1/predictive-decision/history?limit=5');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(predictiveHarness.getDecisionHistory).toHaveBeenCalledWith(5);
  });

  it('returns decision stats', async () => {
    const response = await request(app).get('/api/v1/predictive-decision/stats?daysBack=14');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalDecisions).toBe(3);
    expect(predictiveHarness.getDecisionStats).toHaveBeenCalledWith(14);
  });

  it('triggers a manual decision cycle with parsed config', async () => {
    const response = await request(app)
      .post('/api/v1/predictive-decision/trigger')
      .send({
        triggeredBy: 'dashboard',
        config: {
          scenarioCount: 18,
          seed: 42,
          selectionThreshold: 0.61,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(predictiveHarness.analyzeDecisionPoint).toHaveBeenCalledWith('dashboard', expect.objectContaining({
      scenarioCount: 18,
      seed: 42,
      selectionThreshold: 0.61,
    }));
  });

  it('returns 400 when trigger payload is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/predictive-decision/trigger')
      .send({
        config: {
          scenarioCount: 3,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/greater than or equal to 6|>=6/);
  });

  it('returns 404 when a decision is missing', async () => {
    predictiveHarness.getDecisionResult.mockImplementation(() => {
      throw new Error('Predictive decision not found: missing-id');
    });

    const response = await request(app).get('/api/v1/predictive-decision/missing-id');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('missing-id');
  });

  it('returns 400 when rollback is not allowed', async () => {
    predictiveHarness.rollbackDecision.mockRejectedValue(new Error('Predictive decision already rolled back: pdr-1'));

    const response = await request(app).post('/api/v1/predictive-decision/pdr-1/rollback');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('already rolled back');
  });
});
