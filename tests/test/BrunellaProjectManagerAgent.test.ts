import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrunellaProjectManagerAgent } from '../src/agents/BrunellaProjectManagerAgent.js';

vi.mock('../src/services/brunellaProjectManagerStatus.js', () => ({
  buildBrunellaProjectManagerSnapshot: vi.fn(async () => ({
    checkedAt: '2026-04-08T22:00:00.000Z',
    trackSnapshot: {
      success: true,
      checkedAt: '2026-04-08T22:00:00.000Z',
      overallStats: { total: 0, active: 0, proposed: 0, completed: 0, archived: 0 },
      businessGroupStats: {
        total: 0,
        active: 0,
        proposed: 0,
        completed: 0,
        archived: 0,
        averageProgress: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      activeBusinessTracks: [],
      proposedBusinessTracks: [],
      completedBusinessTracks: [],
      archivedBusinessTracks: [],
      recommendation: {
        headline: 'Nincs elérhető business track',
        rationale: 'No data.',
        nextSteps: [],
      },
    },
    foszalEntries: [],
    ragHits: [],
    warnings: [],
  })),
  renderBrunellaProjectManagerSnapshot: vi.fn(() => '# report'),
}));

describe('BrunellaProjectManagerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a project manager status report', async () => {
    const agent = new BrunellaProjectManagerAgent();
    const result = await agent.executeTask({
      task: 'status',
      payload: { limit: 3, ragLimit: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('# report');
    expect(result.data).toBeDefined();
  });
});
