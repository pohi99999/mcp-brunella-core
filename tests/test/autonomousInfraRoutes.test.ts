import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  ensureAutonomousInfraSeed: vi.fn(),
  hyperKernel: {
    getState: vi.fn(() => ({ cycles: 1 })),
    runCycle: vi.fn((reason: string) => ({ cycleId: 'cycle-1', reason })),
  },
  selfReplication: {
    analyze: vi.fn(() => ({})),
    getNodes: vi.fn(() => []),
    getPlans: vi.fn(() => []),
    requestReplication: vi.fn((sourceNodeId: string, targetRegion: string, reason: string, requestedBy: string) => ({
      planId: 'plan-1',
      sourceNodeId,
      targetRegion,
      reason,
      requestedBy,
    })),
    approvePlan: vi.fn(),
    executePlan: vi.fn(() => ({ nodeId: 'node-1' })),
    completeBootstrap: vi.fn(),
    getPlan: vi.fn(() => ({ planId: 'plan-1' })),
    getNode: vi.fn(() => ({ nodeId: 'node-1' })),
  },
  infraAI: {
    analyze: vi.fn(() => ({})),
    upsertResource: vi.fn((resource: unknown) => resource),
    reportIncident: vi.fn((incident: unknown) => incident),
  },
  globalOptimizer: {
    forecast: vi.fn(() => ({})),
    getSnapshots: vi.fn(() => []),
    getDirectives: vi.fn(() => []),
    recordSnapshot: vi.fn((snapshot: unknown) => snapshot),
  },
  selfModel: {
    getState: vi.fn(() => ({})),
    getSignals: vi.fn(() => []),
    ingestSignal: vi.fn((signal: unknown) => signal),
    reflect: vi.fn(() => ({ health: 'coherent' })),
  },
  goalEngine: {
    getGoals: vi.fn(() => []),
    getDecisions: vi.fn(() => []),
    getStats: vi.fn(() => ({})),
    createGoal: vi.fn((goal: unknown) => ({ goalId: 'goal-1', ...(goal as Record<string, unknown>) })),
  },
  evoEcosystem: {
    getMembers: vi.fn(() => []),
    getDecisions: vi.fn(() => []),
    getStats: vi.fn(() => ({})),
  },
}));

vi.mock('@packages/core-logic/autonomousInfraRuntime.js', () => runtime);

vi.mock('@packages/utils/logger.js', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { createAutonomousInfraRouter } from '@apps/mcp-core/server/routes/autonomousInfra.js';

describe('Autonomous infra routes', () => {
  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/autonomous-infra', createAutonomousInfraRouter());
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes cycle and replication planning inputs before runtime dispatch', async () => {
    const app = createApp();

    const cycle = await request(app)
      .post('/api/v1/autonomous-infra/hyperkernel/cycle')
      .send({ reason: ' manual audit ' });

    expect(cycle.status).toBe(200);
    expect(runtime.hyperKernel.runCycle).toHaveBeenCalledWith('manual audit');

    const plan = await request(app)
      .post('/api/v1/autonomous-infra/self-replication/plan')
      .send({ sourceNodeId: ' core-1 ', targetRegion: ' eu-west ', reason: ' capacity ' });

    expect(plan.status).toBe(200);
    expect(runtime.selfReplication.requestReplication).toHaveBeenCalledWith('core-1', 'eu-west', 'capacity', 'api');
  });

  it('normalizes infra resource, snapshot, signal, and goal payloads', async () => {
    const app = createApp();

    await request(app)
      .post('/api/v1/autonomous-infra/infra/resources')
      .send({
        resourceId: ' worker-a ',
        kind: 'compute',
        region: ' eu-central ',
        utilization: '1.2',
        costPerHour: '-4',
        health: 'degraded',
        redundancy: '2',
        metadata: { owner: 'dashboard' },
      })
      .expect(200);

    expect(runtime.infraAI.upsertResource).toHaveBeenCalledWith(expect.objectContaining({
      resourceId: 'worker-a',
      region: 'eu-central',
      utilization: 1,
      costPerHour: 0,
      redundancy: 2,
      metadata: { owner: 'dashboard' },
    }));

    await request(app)
      .post('/api/v1/autonomous-infra/optimizer/snapshots')
      .send({
        throughput: '12',
        latencyMs: '200',
        errorRate: '2',
        costPerHour: '3',
        resilienceScore: '-1',
        autonomyScore: '0.8',
      })
      .expect(200);

    expect(runtime.globalOptimizer.recordSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      errorRate: 1,
      resilienceScore: 0,
      autonomyScore: 0.8,
    }));

    await request(app)
      .post('/api/v1/autonomous-infra/self-model/signals')
      .send({
        source: ' copilot ',
        category: 'risk',
        confidence: '1.4',
        payload: { area: 'routes' },
      })
      .expect(200);

    expect(runtime.selfModel.ingestSignal).toHaveBeenCalledWith(expect.objectContaining({
      source: 'copilot',
      confidence: 1,
      payload: { area: 'routes' },
    }));

    await request(app)
      .post('/api/v1/autonomous-infra/goals')
      .send({
        title: ' Improve readiness ',
        category: 'alignment',
        metric: 'readiness',
        direction: 'increase',
        targetValue: '0.95',
        currentValue: '0.7',
        priority: '120',
        rationale: ' Dashboard contract drift ',
      })
      .expect(200);

    expect(runtime.goalEngine.createGoal).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Improve readiness',
      priority: 100,
      rationale: 'Dashboard contract drift',
    }));
  });

  it('rejects malformed runtime mutation payloads before side effects', async () => {
    const app = createApp();

    await request(app)
      .post('/api/v1/autonomous-infra/infra/incidents')
      .send({ incidentId: 'i-1', resourceId: 'r-1', type: 'unknown', severity: 'high', summary: 'bad' })
      .expect(400);

    await request(app)
      .post('/api/v1/autonomous-infra/goals')
      .send({ title: 'missing fields' })
      .expect(400);

    expect(runtime.infraAI.reportIncident).not.toHaveBeenCalled();
    expect(runtime.goalEngine.createGoal).not.toHaveBeenCalled();
  });
});
