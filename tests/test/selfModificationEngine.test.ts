import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selfModificationEngine } from '@packages/core-logic/selfModificationEngine.js';
import { agentPerformanceTracker } from '@packages/core-logic/agentPerformanceTracker.js';
import type { SelfModificationProposal } from '@packages/core-logic/selfModificationEngine.js';

function buildProposal(
  id: string,
  status: SelfModificationProposal['status'],
): SelfModificationProposal {
  return {
    id,
    agentName: 'MarketingDirector',
    tomlPath: 'agents/marketing-director.toml',
    status,
    weaknessSummary: 'Success rate below threshold',
    weaknessReasons: ['7 napos sikerarány 50.0%, ami a 70% küszöb alatt van.'],
    rationale: 'Tune the prompt.',
    originalToml: '[agent]\nname="MarketingDirector"\n',
    proposedToml: '[agent]\nname="MarketingDirector"\n',
    diff: '@@',
    testInputs: ['Create campaign'],
    improvement: {
      agentName: 'MarketingDirector',
      sampleCount: 3,
      testsPassed: 3,
      baselineSuccessRate: 0.5,
      candidateSuccessRate: 1,
      successRateDelta: 0.5,
      baselineAvgDurationMs: 1800,
      avgDurationMs: 1400,
      durationImprovementPercent: 0.222,
      improvementPercent: 72.2,
      thresholdPassed: true,
    },
    createdAt: '2026-04-11T10:00:00.000Z',
    updatedAt: '2026-04-11T10:05:00.000Z',
  };
}

describe('SelfModificationEngine overview', () => {
  beforeEach(() => {
    vi.spyOn(agentPerformanceTracker, 'getOverview').mockReturnValue({
      totalRuns: 12,
      agentCount: 3,
      overallSuccessRate: 0.75,
      avgDurationMs: 1420,
      weakAgents: [],
    });
    vi.spyOn(agentPerformanceTracker, 'getWeakAgents').mockReturnValue([
      {
        agentName: 'MarketingDirector',
        totalRuns: 4,
        successRate: 0.5,
        avgDurationMs: 2500,
        minDurationMs: 1200,
        maxDurationMs: 4200,
        failureCount: 2,
        recentErrorTypes: ['timeout'],
        representativeTasks: ['Create launch email'],
        lastRecordedAt: '2026-04-11T09:00:00.000Z',
        weaknessReasons: ['7 napos sikerarány 50.0%, ami a 70% küszöb alatt van.'],
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces the active proposal when an active status exists', () => {
    vi.spyOn(selfModificationEngine, 'listProposals').mockReturnValue([
      buildProposal('proposal-rejected', 'rejected'),
      buildProposal('proposal-applying', 'applying'),
    ]);

    const overview = selfModificationEngine.getOverview();

    expect(overview.summary.totalRuns).toBe(12);
    expect(overview.weakAgents).toHaveLength(1);
    expect(overview.activeProposal?.id).toBe('proposal-applying');
    expect(overview.protectedAgents).toContain('Developer');
  });

  it('leaves activeProposal undefined when only terminal proposals exist', () => {
    vi.spyOn(selfModificationEngine, 'listProposals').mockReturnValue([
      buildProposal('proposal-rejected', 'rejected'),
      buildProposal('proposal-applied', 'applied'),
      buildProposal('proposal-failed', 'failed'),
    ]);

    const overview = selfModificationEngine.getOverview();

    expect(overview.activeProposal).toBeUndefined();
    expect(overview.proposals).toHaveLength(3);
  });
});
