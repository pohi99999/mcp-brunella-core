import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelfImprovementPanel } from '@/components/dashboard/SelfImprovementPanel';
import * as selfModApi from '@/lib/selfModificationApi';

vi.mock('@/lib/selfModificationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/selfModificationApi')>();
  return {
    ...actual,
    getSelfModificationOverview: vi.fn(),
    getSelfModificationProposals: vi.fn(),
    runSelfModification: vi.fn(),
    approveSelfModificationProposal: vi.fn(),
    rejectSelfModificationProposal: vi.fn(),
    runWeeklySelfModificationCycle: vi.fn(),
  };
});

const mockedApi = selfModApi as unknown as {
  getSelfModificationOverview: ReturnType<typeof vi.fn>;
  getSelfModificationProposals: ReturnType<typeof vi.fn>;
  runSelfModification: ReturnType<typeof vi.fn>;
  approveSelfModificationProposal: ReturnType<typeof vi.fn>;
  rejectSelfModificationProposal: ReturnType<typeof vi.fn>;
  runWeeklySelfModificationCycle: ReturnType<typeof vi.fn>;
};

describe('SelfImprovementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getSelfModificationOverview.mockResolvedValue({
      summary: {
        totalRuns: 9,
        agentCount: 3,
        overallSuccessRate: 0.78,
        avgDurationMs: 1600,
      },
      weakAgents: [
        {
          agentName: 'MarketingDirector',
          totalRuns: 4,
          successRate: 0.5,
          avgDurationMs: 2400,
          minDurationMs: 1200,
          maxDurationMs: 3500,
          failureCount: 2,
          weaknessReasons: ['7 napos sikerarány 50.0%, ami a 70% küszöb alatt van.'],
          recentErrorTypes: ['timeout'],
          representativeTasks: ['Create launch email'],
          lastRecordedAt: '2026-04-11T09:00:00.000Z',
        },
      ],
      proposals: [],
      protectedAgents: ['Developer'],
      activeProposal: undefined,
    });
    mockedApi.getSelfModificationProposals.mockResolvedValue([
      {
        id: 'proposal-1',
        agentName: 'MarketingDirector',
        status: 'pending_review',
        weaknessSummary: 'Low success rate',
        weaknessReasons: ['7 napos sikerarány 50.0%, ami a 70% küszöb alatt van.'],
        rationale: 'Tune prompt',
        tomlPath: 'agents/marketing-director.toml',
        proposedToml: '[agent]\nname="MarketingDirector"\n',
        diff: '@@',
        testInputs: ['Create launch email'],
        improvement: {
          agentName: 'MarketingDirector',
          sampleCount: 3,
          testsPassed: 3,
          baselineSuccessRate: 0.5,
          candidateSuccessRate: 1,
          successRateDelta: 0.5,
          baselineAvgDurationMs: 1800,
          avgDurationMs: 1400,
          durationImprovementPercent: 0.22,
          improvementPercent: 72.2,
          thresholdPassed: true,
        },
        createdAt: '2026-04-11T10:00:00.000Z',
        updatedAt: '2026-04-11T10:05:00.000Z',
      },
    ]);
    mockedApi.runSelfModification.mockResolvedValue({ id: 'proposal-2' });
    mockedApi.approveSelfModificationProposal.mockResolvedValue({ id: 'proposal-1' });
    mockedApi.rejectSelfModificationProposal.mockResolvedValue({ id: 'proposal-1' });
    mockedApi.runWeeklySelfModificationCycle.mockResolvedValue({ triggeredAt: '2026-04-11T10:10:00.000Z' });
  });

  it('loads overview stats, weak agents, and proposal queue', async () => {
    render(<SelfImprovementPanel />);

    expect(await screen.findByText('Self-Improvement Control')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getSelfModificationOverview).toHaveBeenCalledTimes(1);
      expect(mockedApi.getSelfModificationProposals).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('selfmod-stat-runs')).toHaveTextContent('9');
    expect(screen.getByTestId('selfmod-stat-weak')).toHaveTextContent('1');
    expect(screen.getByTestId('selfmod-weak-MarketingDirector')).toBeInTheDocument();
    expect(screen.getByTestId('selfmod-proposal-proposal-1')).toBeInTheDocument();
  });

  it('runs a manual proposal and refreshes the panel', async () => {
    render(<SelfImprovementPanel />);
    await screen.findByText('Self-Improvement Control');

    fireEvent.change(screen.getByTestId('selfmod-agent-input'), {
      target: { value: 'MarketingDirector' },
    });
    fireEvent.click(screen.getByTestId('selfmod-run-button'));

    await waitFor(() => {
      expect(mockedApi.runSelfModification).toHaveBeenCalledWith('MarketingDirector', false);
    });
    expect(mockedApi.getSelfModificationOverview).toHaveBeenCalledTimes(2);
  });

  it('approves a pending proposal', async () => {
    render(<SelfImprovementPanel />);
    await screen.findByText('Self-Improvement Control');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(mockedApi.approveSelfModificationProposal).toHaveBeenCalledWith('proposal-1');
    });
  });
});
