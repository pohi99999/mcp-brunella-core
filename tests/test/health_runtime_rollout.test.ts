import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const healthRouteHarness = vi.hoisted(() => ({
  listAgents: vi.fn(() => [{ name: 'agent' }]),
  getServersStatus: vi.fn(() => []),
  getRuntimeTelemetry: vi.fn(() => ({ pid: 1, uptimeSeconds: 10, memory: { state: 'healthy' } })),
  getRuntimeDriftSnapshot: vi.fn(() => ({
    summary: {
      overallState: 'warn',
      sampleCount: 12,
      recommendation: {
        overallAction: 'tune',
        confidence: 'high',
        rationale: 'Observed pressure',
        signals: ['node_pressure'],
        node: {
          action: 'tune',
          rationale: 'Node pressure',
          current: { heapMb: 1536, runtimeLimitMb: 2048, restartThresholdMb: 1792 },
          suggested: { heapMb: 1792, runtimeLimitMb: 2304, restartThresholdMb: 2048 },
        },
        python: {
          action: 'observe',
          rationale: 'Observe python',
          current: { memoryLimitMb: 1024 },
          suggested: { memoryLimitMb: 1024 },
        },
      },
      node: { driftCount: 1, restartCount: 0 },
      python: { status: 'healthy', restartCount: 0, unavailableCount: 0 },
    },
    samples: [],
  })),
  buildThresholdRolloutPlan: vi.fn(() => ({
    approvalRequired: true,
    canApply: true,
    changes: ['Node heap 1536MB -> 1792MB'],
  })),
  readRepoRuntimeContract: vi.fn(() => ({
    configuredHeapMb: 1536,
    runtimeMemoryLimitMb: 2048,
    restartThresholdMb: 1792,
    pythonMemoryLimitMb: 1024,
  })),
  getLatestRuntimeThresholdRolloutJournalSummary: vi.fn(() => ({
    id: 7,
    recordedAt: '2026-04-02T12:00:00.000Z',
    approvedBy: 'Ops Lead',
    approvalTicket: 'CHG-2026-040',
    approvedAt: '2026-04-02T11:00:00.000Z',
    changeWindow: '2026-04-02 12:00-13:00 UTC',
    notes: 'Canary only.',
    overallAction: 'tune',
    confidence: 'high',
    overallState: 'warn',
    sampleCount: 12,
    lastSampleAt: '2026-04-02T10:11:12.000Z',
    canApply: true,
    applyReadOnlyReason: null,
  })),
  checkOllamaHealth: vi.fn(async () => ({ status: 'healthy' })),
  checkAnythingLLMHealth: vi.fn(async () => ({ status: 'healthy' })),
  checkPythonHealth: vi.fn(async () => ({ status: 'healthy' })),
  checkN8nHealth: vi.fn(async () => ({ status: 'healthy' })),
  checkLangflowHealth: vi.fn(async () => ({ status: 'healthy' })),
  checkCloudflareHealth: vi.fn(async () => ({ status: 'healthy' })),
  buildHealthResponse: vi.fn(() => ({ status: 'ok', services: {} })),
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: { listAgents: healthRouteHarness.listAgents },
}));

vi.mock('@apps/mcp-core/server/McpProcessManager.js', () => ({
  mcpProcessManager: { getServersStatus: healthRouteHarness.getServersStatus },
}));

vi.mock('@packages/utils/runtimeTelemetry.js', () => ({
  getRuntimeTelemetry: healthRouteHarness.getRuntimeTelemetry,
}));

vi.mock('@packages/utils/runtimeDriftMonitor.js', () => ({
  getRuntimeDriftSnapshot: healthRouteHarness.getRuntimeDriftSnapshot,
}));

vi.mock('@packages/utils/runtimeThresholdRollout.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@packages/utils/runtimeThresholdRollout.js')>();
  return {
    ...actual,
    buildThresholdRolloutPlan: healthRouteHarness.buildThresholdRolloutPlan,
    readRepoRuntimeContract: healthRouteHarness.readRepoRuntimeContract,
  };
});

vi.mock('@packages/utils/globalDb.js', () => ({
  getLatestRuntimeThresholdRolloutJournalSummary:
    healthRouteHarness.getLatestRuntimeThresholdRolloutJournalSummary,
}));

vi.mock('@packages/utils/health.js', () => ({
  checkOllamaHealth: healthRouteHarness.checkOllamaHealth,
  checkAnythingLLMHealth: healthRouteHarness.checkAnythingLLMHealth,
  checkPythonHealth: healthRouteHarness.checkPythonHealth,
  checkN8nHealth: healthRouteHarness.checkN8nHealth,
  checkLangflowHealth: healthRouteHarness.checkLangflowHealth,
  checkCloudflareHealth: healthRouteHarness.checkCloudflareHealth,
  buildHealthResponse: healthRouteHarness.buildHealthResponse,
}));

vi.mock('@apps/mcp-core/server/middleware/errorHandler.js', () => ({
  asyncHandler:
    (handler: (...args: any[]) => unknown) =>
    (req: unknown, res: unknown, next: (error?: unknown) => void) =>
      Promise.resolve(handler(req, res)).catch(next),
}));

import { createHealthRoutes } from '@apps/mcp-core/server/routes/health.js';

describe('health runtime rollout route', () => {
  it('returns rollout metadata on runtime-drift endpoint', async () => {
    const app = express();
    app.use('/api/health', createHealthRoutes());

    const response = await request(app).get('/api/health/runtime-drift');

    expect(response.status).toBe(200);
    expect(response.body.summary.overallState).toBe('warn');
    expect(response.body.rollout.approvalRequired).toBe(true);
    expect(response.body.latestJournalEntry.approvalTicket).toBe('CHG-2026-040');
    expect(healthRouteHarness.buildThresholdRolloutPlan).toHaveBeenCalled();
  });
});
