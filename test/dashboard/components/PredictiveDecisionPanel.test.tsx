import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PredictiveDecisionPanel } from '@/components/dashboard/PredictiveDecisionPanel';
import * as predictiveApi from '@/lib/predictiveDecisionApi';

vi.mock('@/lib/predictiveDecisionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/predictiveDecisionApi')>();
  return {
    ...actual,
    getDecisionHistory: vi.fn(),
    getDecisionStats: vi.fn(),
    triggerDecision: vi.fn(),
    rollbackDecision: vi.fn(),
  };
});

const mockedApi = predictiveApi as unknown as {
  getDecisionHistory: ReturnType<typeof vi.fn>;
  getDecisionStats: ReturnType<typeof vi.fn>;
  triggerDecision: ReturnType<typeof vi.fn>;
  rollbackDecision: ReturnType<typeof vi.fn>;
};

describe('PredictiveDecisionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getDecisionHistory.mockResolvedValue([
      {
        id: 'pdr-1',
        triggeredBy: 'dashboard',
        scenarios: new Array(6).fill(null).map((_, index) => ({
          id: `scenario-${index}`,
          iteration: index,
          candidate: {
            sourceType: 'predictive_alert',
            sourceId: 'alert-1',
            title: 'Cost spike',
            summary: 'Infra cost spiked',
            action: {
              type: 'create_goal',
              description: 'Create follow-up goal',
              payload: {},
              reversible: true,
            },
            riskBase: 0.2,
            impactBase: 0.8,
            alignmentBase: 0.7,
          },
          action: {
            type: 'create_goal',
            description: 'Create follow-up goal',
            payload: {},
            reversible: true,
          },
          riskScore: 0.2,
          impactScore: 0.8,
          alignmentScore: 0.7,
          totalScore: 0.74,
          rationale: 'predictive_alert:alert-1',
        })),
        selectedScenario: {
          id: 'scenario-selected',
          iteration: 0,
          candidate: {
            sourceType: 'predictive_alert',
            sourceId: 'alert-1',
            title: 'Cost spike',
            summary: 'Infra cost spiked',
            action: {
              type: 'create_goal',
              description: 'Create follow-up goal',
              payload: {},
              reversible: true,
            },
            riskBase: 0.2,
            impactBase: 0.8,
            alignmentBase: 0.7,
          },
          action: {
            type: 'create_goal',
            description: 'Create follow-up goal',
            payload: {},
            reversible: true,
          },
          riskScore: 0.2,
          impactScore: 0.8,
          alignmentScore: 0.7,
          totalScore: 0.742,
          rationale: 'predictive_alert:alert-1',
        },
        executedAction: {
          success: true,
          actionId: 'exec-1',
          actionType: 'create_goal',
          description: 'Create follow-up goal',
          resultData: { goalId: 'goal-1' },
          rollbackData: { goalId: 'goal-1' },
          executedAt: '2026-04-11T10:00:00.000Z',
        },
        rollbackCapability: true,
        outcome: 'executed',
        createdAt: '2026-04-11T10:00:00.000Z',
        rolledBackAt: null,
        metadata: {
          activeAlerts: 2,
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
    ]);
    mockedApi.getDecisionStats.mockResolvedValue({
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
    });
    mockedApi.triggerDecision.mockResolvedValue({ id: 'pdr-new' });
    mockedApi.rollbackDecision.mockResolvedValue({ id: 'pdr-1' });
  });

  it('loads decision stats and recent runs', async () => {
    render(<PredictiveDecisionPanel />);

    expect(await screen.findByText('Predictive Decision')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getDecisionHistory).toHaveBeenCalledTimes(1);
      expect(mockedApi.getDecisionStats).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Recent runs')).toBeInTheDocument();
    expect(screen.getByTestId('predictive-decision-pdr-1')).toBeInTheDocument();
    expect(screen.getByText('create_goal')).toBeInTheDocument();
  });

  it('triggers a manual decision cycle and refreshes the panel', async () => {
    render(<PredictiveDecisionPanel />);
    await screen.findByText('Predictive Decision');

    fireEvent.click(screen.getByTestId('predictive-trigger-button'));

    await waitFor(() => {
      expect(mockedApi.triggerDecision).toHaveBeenCalledWith('dashboard');
    });
    expect(mockedApi.getDecisionHistory).toHaveBeenCalledTimes(2);
    expect(mockedApi.getDecisionStats).toHaveBeenCalledTimes(2);
  });

  it('rolls back a reversible decision and refreshes the panel', async () => {
    render(<PredictiveDecisionPanel />);
    await screen.findByText('Predictive Decision');

    fireEvent.click(await screen.findByRole('button', { name: 'Rollback' }));

    await waitFor(() => {
      expect(mockedApi.rollbackDecision).toHaveBeenCalledWith('pdr-1');
    });
    expect(mockedApi.getDecisionHistory).toHaveBeenCalledTimes(2);
    expect(mockedApi.getDecisionStats).toHaveBeenCalledTimes(2);
  });
});
