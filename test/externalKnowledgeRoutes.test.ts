import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const routeHarness = vi.hoisted(() => ({
  addToIndex: vi.fn(),
  searchRAG: vi.fn(),
  fireHookSafely: vi.fn(),
}));

vi.mock('../src/utils/rag.js', () => ({
  addToIndex: routeHarness.addToIndex,
  searchRAG: routeHarness.searchRAG,
}));

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHookSafely: routeHarness.fireHookSafely,
}));

import { createExternalKnowledgeRoutes } from '../src/server/routes/externalKnowledge.js';
import { initExternalKnowledgeSchema } from '../src/server/services/externalKnowledgeService.js';

const db = new Database(':memory:');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/knowledge', createExternalKnowledgeRoutes(db));
  return app;
}

describe('External knowledge routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeHarness.searchRAG.mockResolvedValue([]);
    routeHarness.fireHookSafely.mockResolvedValue(null);

    initExternalKnowledgeSchema(db);

    db.exec('DELETE FROM external_knowledge_chunks;');
    db.exec('DELETE FROM external_knowledge_sources;');
    db.exec('DELETE FROM knowledge_cards;');
  });

  afterAll(() => {
    db.close();
  });

  it('returns the policy health snapshot', async () => {
    const response = await request(createApp()).get('/api/v1/knowledge/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.policy.canonicalOnlyRagIndexing).toBe(true);
  });

  it('ingests a web source through the API', async () => {
    const response = await request(createApp())
      .post('/api/v1/knowledge/sources/web')
      .send({
        url: 'https://example.com/knowledge',
        content: 'Web payload for staged ingestion.',
        tags: ['nova', 'workflow'],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.source.status).toBe('screened');
    expect(response.body.source.tags).toEqual(['nova', 'workflow']);
  });

  it('creates a provisional card and lists it in the review queue', async () => {
    const ingest = await request(createApp())
      .post('/api/v1/knowledge/sources/youtube')
      .send({
        url: 'https://youtube.com/watch?v=abc',
        transcript: 'Transcript content for route test.',
      });

    const sourceId = ingest.body.source.id as string;

    const create = await request(createApp())
      .post('/api/v1/knowledge/cards')
      .send({
        sourceIds: [sourceId],
        summary: 'Route-created provisional card.',
        claims: ['Route-created provisional card.'],
      });

    expect(create.status).toBe(201);
    expect(create.body.card.status).toBe('provisional');

    const queue = await request(createApp()).get('/api/v1/knowledge/review-queue');
    expect(queue.status).toBe(200);
    expect(queue.body.count).toBe(1);
    expect(queue.body.items[0].id).toBe(create.body.card.id);
  });

  it('rejects invalid promotion requests', async () => {
    const response = await request(createApp())
      .post('/api/v1/knowledge/cards/missing-card/promote')
      .send({ reviewer: 'Copilot' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('promotes cards and exposes them through search', async () => {
    const app = createApp();
    const sourceA = await request(app).post('/api/v1/knowledge/sources/web').send({
      url: 'https://example.com/1',
      content: 'Source A confirms the external knowledge workflow.',
    });
    const sourceB = await request(app).post('/api/v1/knowledge/sources/web').send({
      url: 'https://example.com/2',
      content: 'Source B confirms the same workflow.',
    });

    const create = await request(app).post('/api/v1/knowledge/cards').send({
      sourceIds: [sourceA.body.source.id, sourceB.body.source.id],
      title: 'Workflow card',
      summary: 'Canonical workflow card for search.',
      claims: ['Canonical workflow card for search.'],
    });

    routeHarness.searchRAG.mockResolvedValueOnce([
      { path: `knowledge_card:${create.body.card.id}`, score: 0.2, text: 'workflow card' },
    ]);

    const promote = await request(app)
      .post(`/api/v1/knowledge/cards/${create.body.card.id}/promote`)
      .send({ reviewer: 'Copilot', note: 'Two-source approval.' });

    expect(promote.status).toBe(200);
    expect(promote.body.card.status).toBe('canonical');
    expect(routeHarness.addToIndex).toHaveBeenCalledTimes(1);

    const search = await request(app).get('/api/v1/knowledge/search?query=workflow&limit=10');
    expect(search.status).toBe(200);
    expect(search.body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: create.body.card.id }),
      ]),
    );
  });
});
