import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDecisionHistory,
  getDecisionStats,
  rollbackDecision,
  triggerDecision,
} from '../../../src/dashboard/lib/predictiveDecisionApi.js';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : String(status),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('predictiveDecisionApi', () => {
  it('returns decision history from the API', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: [
        {
          id: 'pdr-1',
          triggeredBy: 'dashboard',
          scenarios: [],
          selectedScenario: null,
          executedAction: null,
          rollbackCapability: false,
          outcome: 'no_action',
          createdAt: '2026-04-11T10:00:00.000Z',
          rolledBackAt: null,
          metadata: {
            activeAlerts: 1,
            signalCount: 1,
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
        },
      ],
    }));

    const result = await getDecisionHistory(8);

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/predictive-decision/history?limit=8'),
      expect.any(Object),
    );
  });

  it('posts trigger payload with triggeredBy and config', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        id: 'pdr-2',
        triggeredBy: 'dashboard',
        scenarios: [],
        selectedScenario: null,
        executedAction: null,
        rollbackCapability: false,
        outcome: 'no_action',
        createdAt: '2026-04-11T10:00:00.000Z',
        rolledBackAt: null,
        metadata: {
          activeAlerts: 0,
          signalCount: 0,
          reviewQueueCount: 0,
          activeGoals: 0,
          config: {
            scenarioCount: 24,
            riskWeight: 0.3,
            impactWeight: 0.4,
            alignmentWeight: 0.3,
            selectionThreshold: 0.6,
            seed: 77,
          },
        },
      },
    }));

    await triggerDecision('dashboard', { scenarioCount: 24, seed: 77, selectionThreshold: 0.6 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/predictive-decision/trigger'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          triggeredBy: 'dashboard',
          config: {
            scenarioCount: 24,
            seed: 77,
            selectionThreshold: 0.6,
          },
        }),
      }),
    );
  });

  it('throws the API error on rollback failure', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: false,
      error: 'Predictive decision already rolled back: pdr-3',
    }, 400));

    await expect(rollbackDecision('pdr-3')).rejects.toThrow('Predictive decision already rolled back: pdr-3');
  });

  it('returns decision stats from the API', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        totalDecisions: 4,
        actionsExecuted: 2,
        noActionDecisions: 1,
        failedActions: 0,
        rolledBackActions: 1,
        successRate: 0.5,
        averageScenarioCount: 10,
        averageSelectedScore: 0.72,
        actionBreakdown: [{ actionType: 'create_goal', count: 2 }],
        dateRange: {
          from: '2026-03-12T00:00:00.000Z',
          to: '2026-04-11T00:00:00.000Z',
        },
      },
    }));

    const result = await getDecisionStats(14);

    expect(result.totalDecisions).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/predictive-decision/stats?daysBack=14'),
      expect.any(Object),
    );
  });
});
