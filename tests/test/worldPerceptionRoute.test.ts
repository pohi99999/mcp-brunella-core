import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const perceptionHarness = vi.hoisted(() => ({
  getOverview: vi.fn(),
  listSignals: vi.fn(),
  ingestSignal: vi.fn(),
  runCycle: vi.fn(),
  promoteSignal: vi.fn(),
  ignoreSignal: vi.fn(),
}));

vi.mock('../src/core/worldPerceptionLayer.js', () => ({
  getWorldPerceptionOverview: perceptionHarness.getOverview,
  listWorldSignals: perceptionHarness.listSignals,
  ingestWorldSignal: perceptionHarness.ingestSignal,
  runWorldPerceptionCycle: perceptionHarness.runCycle,
  promoteWorldSignal: perceptionHarness.promoteSignal,
  ignoreWorldSignal: perceptionHarness.ignoreSignal,
}));

import { createWorldPerceptionRouter } from '../src/server/routes/worldPerception.js';

describe('WorldPerception route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/world-perception', createWorldPerceptionRouter());

  beforeEach(() => {
    vi.clearAllMocks();
    perceptionHarness.getOverview.mockReturnValue({
      generatedAt: '2026-04-11T10:00:00.000Z',
      summary: { totalSignals: 4, detected: 2, promoted: 1, ignored: 1, avgScore: 0.72 },
      domainCoverage: [{ domain: 'technology', count: 2 }],
      pendingSignals: [],
      freshestSignals: [],
      recentPromotions: [],
    });
    perceptionHarness.listSignals.mockReturnValue([]);
    perceptionHarness.runCycle.mockReturnValue({
      triggeredAt: '2026-04-11T10:00:00.000Z',
      scannedCards: 3,
      ingestedSignals: 2,
      createdSignals: 1,
      refreshedSignals: 1,
      topSignals: [],
    });
  });

  it('returns overview payload', async () => {
    const response = await request(app).get('/api/v1/world-perception/overview');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.totalSignals).toBe(4);
  });

  it('forwards observe requests with default manual source type', async () => {
    perceptionHarness.ingestSignal.mockReturnValue({
      id: 'wps-1',
      title: 'Fresh signal',
      status: 'detected',
    });

    const response = await request(app)
      .post('/api/v1/world-perception/observe')
      .send({
        source: 'manual-input',
        title: 'Fresh signal',
        summary: 'A concise world signal.',
        domain: 'technology',
        provenance: 'user entry',
      });

    expect(response.status).toBe(200);
    expect(perceptionHarness.ingestSignal).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'manual',
      biasLabel: 'unknown',
      domain: 'technology',
    }));
    expect(response.body.data.id).toBe('wps-1');
  });

  it('returns 400 when promotion fails', async () => {
    perceptionHarness.promoteSignal.mockRejectedValue(new Error('already promoted'));

    const response = await request(app)
      .post('/api/v1/world-perception/signals/wps-9/promote')
      .send({ reviewer: 'dashboard' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('already promoted');
  });
});
