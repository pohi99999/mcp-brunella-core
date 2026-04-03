import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const observabilityRouteHarness = vi.hoisted(() => ({
  queryLlmCalls: vi.fn(() => []),
  getLlmCallStats: vi.fn(() => ({
    totalCalls: 0,
    successRate: 100,
    avgDurationMs: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    byProvider: [],
    byModel: [],
    recentErrors: [],
  })),
  queryRuntimeThresholdRolloutJournalSummaries: vi.fn(() => [
    {
      id: 7,
      recordedAt: '2026-04-02T11:01:00Z',
      approvedBy: 'Ops Lead',
      approvalTicket: 'CHG-2026-040',
      approvedAt: '2026-04-02T11:00:00Z',
      changeWindow: '2026-04-02 12:00-13:00 UTC',
      notes: 'Canary only.',
      overallAction: 'tune',
      confidence: 'high',
      overallState: 'warn',
      sampleCount: 18,
      lastSampleAt: '2026-04-02T10:11:12.000Z',
      canApply: true,
      applyReadOnlyReason: null,
    },
  ]),
  getLatestRuntimeThresholdRolloutJournalSummary: vi.fn(() => ({
    id: 7,
    recordedAt: '2026-04-02T11:01:00Z',
    approvedBy: 'Ops Lead',
    approvalTicket: 'CHG-2026-040',
    approvedAt: '2026-04-02T11:00:00Z',
    changeWindow: '2026-04-02 12:00-13:00 UTC',
    notes: 'Canary only.',
    overallAction: 'tune',
    confidence: 'high',
    overallState: 'warn',
    sampleCount: 18,
    lastSampleAt: '2026-04-02T10:11:12.000Z',
    canApply: true,
    applyReadOnlyReason: null,
  })),
  recordRuntimeThresholdRolloutJournal: vi.fn(() => ({
    id: 8,
    recordedAt: '2026-04-02T11:05:00Z',
    approvedBy: 'Ops Lead',
    approvalTicket: 'CHG-2026-041',
    approvedAt: '2026-04-02T11:00:00Z',
    changeWindow: '2026-04-02 12:00-13:00 UTC',
    notes: 'Second canary.',
    overallAction: 'tune',
    confidence: 'high',
    overallState: 'warn',
    sampleCount: 18,
    lastSampleAt: '2026-04-02T10:11:12.000Z',
    canApply: true,
    applyReadOnlyReason: null,
    summary: { overallState: 'warn', sampleCount: 18, recommendation: { overallAction: 'tune' } },
    plan: {
      overallAction: 'tune',
      confidence: 'high',
      rationale: 'Guarded increase',
      current: {
        configuredHeapMb: 1536,
        runtimeMemoryLimitMb: 2048,
        restartThresholdMb: 1792,
        pythonMemoryLimitMb: 1024,
      },
      proposed: {
        configuredHeapMb: 1792,
        runtimeMemoryLimitMb: 2304,
        restartThresholdMb: 2048,
        pythonMemoryLimitMb: 1152,
      },
      approvalRequired: true,
      canApply: true,
      applyReadOnlyReason: null,
      changes: ['Node heap 1536MB -> 1792MB'],
      warnings: [],
      managedFiles: ['config/runtime-threshold-contract.env'],
    },
    renderedPlan: 'Runtime threshold rollout planning (read-only)',
  })),
  renderThresholdRolloutPlan: vi.fn(() => ({
    renderedPlan: 'Runtime threshold rollout planning (read-only)',
    approved: true,
    canRenderRollout: true,
    missingApprovalFields: [],
  })),
  buildThresholdRolloutPlan: vi.fn(() => ({
    overallAction: 'tune',
    confidence: 'high',
    rationale: 'Guarded increase',
    current: {
      configuredHeapMb: 1536,
      runtimeMemoryLimitMb: 2048,
      restartThresholdMb: 1792,
      pythonMemoryLimitMb: 1024,
    },
    proposed: {
      configuredHeapMb: 1792,
      runtimeMemoryLimitMb: 2304,
      restartThresholdMb: 2048,
      pythonMemoryLimitMb: 1152,
    },
    approvalRequired: true,
    canApply: true,
    applyReadOnlyReason: null,
    changes: ['Node heap 1536MB -> 1792MB'],
    warnings: [],
    managedFiles: ['config/runtime-threshold-contract.env'],
  })),
  extractRuntimeTuningRecommendation: vi.fn(() => ({
    overallAction: 'tune',
    confidence: 'high',
    rationale: 'Guarded increase',
    signals: ['node_heap_pressure'],
    node: {
      action: 'tune',
      rationale: 'Node pressure',
      current: { heapMb: 1536, runtimeLimitMb: 2048, restartThresholdMb: 1792 },
      suggested: { heapMb: 1792, runtimeLimitMb: 2304, restartThresholdMb: 2048 },
    },
    python: {
      action: 'tune',
      rationale: 'Python pressure',
      current: { memoryLimitMb: 1024 },
      suggested: { memoryLimitMb: 1152 },
    },
  })),
  readRepoRuntimeContract: vi.fn(() => ({
    configuredHeapMb: 1536,
    runtimeMemoryLimitMb: 2048,
    restartThresholdMb: 1792,
    pythonMemoryLimitMb: 1024,
  })),
  getRuntimeDriftSnapshot: vi.fn(() => ({
    summary: {
      overallState: 'warn',
      sampleCount: 18,
      lastSampleAt: '2026-04-02T10:11:12.000Z',
      recommendation: {
        overallAction: 'tune',
        confidence: 'high',
        rationale: 'Operator approved tuning candidate.',
        signals: ['node_heap_pressure'],
        node: {
          action: 'tune',
          rationale: 'Node pressure visible.',
          current: { heapMb: 1536, runtimeLimitMb: 2048, restartThresholdMb: 1792 },
          suggested: { heapMb: 1792, runtimeLimitMb: 2304, restartThresholdMb: 2048 },
        },
        python: {
          action: 'tune',
          rationale: 'Python pressure visible.',
          current: { memoryLimitMb: 1024 },
          suggested: { memoryLimitMb: 1152 },
        },
      },
    },
  })),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  queryLlmCalls: observabilityRouteHarness.queryLlmCalls,
  getLlmCallStats: observabilityRouteHarness.getLlmCallStats,
  queryRuntimeThresholdRolloutJournalSummaries:
    observabilityRouteHarness.queryRuntimeThresholdRolloutJournalSummaries,
  getLatestRuntimeThresholdRolloutJournalSummary:
    observabilityRouteHarness.getLatestRuntimeThresholdRolloutJournalSummary,
  recordRuntimeThresholdRolloutJournal:
    observabilityRouteHarness.recordRuntimeThresholdRolloutJournal,
}));

vi.mock('../src/utils/runtimeThresholdRollout.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/runtimeThresholdRollout.js')>();
  return {
    ...actual,
    renderThresholdRolloutPlan: observabilityRouteHarness.renderThresholdRolloutPlan,
    buildThresholdRolloutPlan: observabilityRouteHarness.buildThresholdRolloutPlan,
    extractRuntimeTuningRecommendation:
      observabilityRouteHarness.extractRuntimeTuningRecommendation,
    readRepoRuntimeContract: observabilityRouteHarness.readRepoRuntimeContract,
  };
});

vi.mock('../src/utils/runtimeDriftMonitor.js', () => ({
  getRuntimeDriftSnapshot: observabilityRouteHarness.getRuntimeDriftSnapshot,
}));

import { createObservabilityRouter } from '../src/server/routes/observability.js';

describe('observability runtime threshold rollout routes', () => {
  it('lists rollout journal entries', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/observability', createObservabilityRouter());

    const response = await request(app).get('/api/v1/observability/runtime-threshold-rollouts?limit=5');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.entries[0].approvalTicket).toBe('CHG-2026-040');
    expect(observabilityRouteHarness.queryRuntimeThresholdRolloutJournalSummaries)
      .toHaveBeenCalledWith({ approvalTicket: undefined, limit: 5, offset: 0 });
  });

  it('records an approved rollout journal entry', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/observability', createObservabilityRouter());

    const response = await request(app)
      .post('/api/v1/observability/runtime-threshold-rollouts')
      .send({
        approvedBy: 'Ops Lead',
        approvalTicket: 'CHG-2026-041',
        approvedAt: '2026-04-02T11:00:00Z',
        changeWindow: '2026-04-02 12:00-13:00 UTC',
        notes: 'Second canary.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.entry.id).toBe(8);
    expect(observabilityRouteHarness.recordRuntimeThresholdRolloutJournal).toHaveBeenCalled();
  });
});
