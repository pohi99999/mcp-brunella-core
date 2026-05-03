import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const briefingMocks = vi.hoisted(() => ({
  runDailyAgentBriefing: vi.fn(),
}));

vi.mock('@packages/core-logic/services/briefingService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@packages/core-logic/services/briefingService.js')>();
  return {
    ...actual,
    runDailyAgentBriefing: briefingMocks.runDailyAgentBriefing,
  };
});

import { createBriefingRoutes } from '@apps/mcp-core/server/routes/briefing.js';

function createApp() {
  const db = new Database(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/briefing', createBriefingRoutes(db));
  return { app, db };
}

describe('Briefing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    briefingMocks.runDailyAgentBriefing.mockResolvedValue({
      id: 'briefing-1',
      generatedAt: '2026-05-02T00:00:00.000Z',
      reportDate: '2026-05-02',
      items: [],
      brunellaLayers: [],
      markdownPath: null,
      triggeredBy: 'api',
      dryRun: false,
    });
  });

  it('returns 404 when no briefing report exists', async () => {
    const { app, db } = createApp();

    const response = await request(app).get('/api/v1/briefing/reports/latest');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Még nem készült');
    db.close();
  });

  it('normalizes dryRun input for on-demand briefing runs', async () => {
    const { app, db } = createApp();

    const response = await request(app)
      .post('/api/v1/briefing/run')
      .send({ dryRun: ' true ' });

    expect(response.status).toBe(200);
    expect(briefingMocks.runDailyAgentBriefing).toHaveBeenCalledWith({
      triggeredBy: 'api',
      dryRun: true,
      db,
    });
    db.close();
  });
});
