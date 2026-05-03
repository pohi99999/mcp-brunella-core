import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const selfModHarness = vi.hoisted(() => ({
  getOverview: vi.fn(),
  listProposals: vi.fn(),
  getProposal: vi.fn(),
  improveAgent: vi.fn(),
  runWeeklyCycle: vi.fn(),
  retestProposal: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

const trackerHarness = vi.hoisted(() => ({
  getWeakAgents: vi.fn(),
}));

vi.mock('@packages/core-logic/selfModificationEngine.js', () => ({
  selfModificationEngine: selfModHarness,
}));

vi.mock('@packages/core-logic/agentPerformanceTracker.js', () => ({
  agentPerformanceTracker: trackerHarness,
}));

vi.mock('@packages/utils/logger.js', () => ({
  logError: vi.fn(),
}));

import { createSelfModificationRouter } from '@apps/mcp-core/server/routes/selfModification.js';

describe('SelfModification route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/self-modification', createSelfModificationRouter());

  beforeEach(() => {
    vi.clearAllMocks();
    selfModHarness.getOverview.mockReturnValue({
      summary: { totalRuns: 5, agentCount: 2, overallSuccessRate: 0.8, avgDurationMs: 2100 },
      weakAgents: [],
      proposals: [],
      activeProposal: undefined,
      protectedAgents: ['Developer'],
    });
    selfModHarness.listProposals.mockReturnValue([]);
    trackerHarness.getWeakAgents.mockReturnValue([]);
  });

  it('returns overview payload', async () => {
    const response = await request(app).get('/api/v1/self-modification/overview');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.totalRuns).toBe(5);
  });

  it('forwards improve requests with API trigger metadata', async () => {
    selfModHarness.improveAgent.mockResolvedValue({
      id: 'proposal-1',
      agentName: 'MarketingDirector',
      status: 'pending_review',
    });

    const response = await request(app)
      .post('/api/v1/self-modification/improve/%20MarketingDirector%20')
      .send({ force: ' true ', minRuns: 5, successThreshold: 7, durationThresholdMs: -10 });

    expect(response.status).toBe(200);
    expect(selfModHarness.improveAgent).toHaveBeenCalledWith('MarketingDirector', expect.objectContaining({
      force: true,
      minRuns: 5,
      successThreshold: 1,
      durationThresholdMs: 0,
      triggeredBy: 'api',
    }));
    expect(response.body.data.id).toBe('proposal-1');
  });

  it('returns filtered proposals', async () => {
    selfModHarness.listProposals.mockReturnValue([
      { id: 'proposal-2', status: 'approved' },
    ]);

    const response = await request(app).get('/api/v1/self-modification/proposals?status=approved&limit=999');

    expect(response.status).toBe(200);
    expect(selfModHarness.listProposals).toHaveBeenCalledWith('approved', 100);
    expect(response.body.count).toBe(1);
  });

  it('normalizes weak-agent query bounds', async () => {
    const response = await request(app)
      .get('/api/v1/self-modification/weak-agents?days=999&successThreshold=-2&durationThresholdMs=-5&minRuns=0&limit=999');

    expect(response.status).toBe(200);
    expect(trackerHarness.getWeakAgents).toHaveBeenCalledWith({
      days: 365,
      successThreshold: 0,
      durationThresholdMs: 1,
      minRuns: 1,
      limit: 50,
    });
  });

  it('trims proposal review inputs', async () => {
    selfModHarness.approveProposal.mockResolvedValue({ id: 'proposal-3', status: 'approved' });

    const response = await request(app)
      .post('/api/v1/self-modification/proposals/%20proposal-3%20/approve')
      .send({ reviewer: '  dashboard  ', notes: '  accepted  ' });

    expect(response.status).toBe(200);
    expect(selfModHarness.approveProposal).toHaveBeenCalledWith('proposal-3', {
      reviewer: 'dashboard',
      notes: 'accepted',
    });
  });

  it('returns 400 when approval fails', async () => {
    selfModHarness.approveProposal.mockRejectedValue(new Error('already applied'));

    const response = await request(app)
      .post('/api/v1/self-modification/proposals/proposal-3/approve')
      .send({ reviewer: 'dashboard' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('already applied');
  });
});
