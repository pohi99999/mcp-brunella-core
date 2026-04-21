import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ragHarness = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ enabled: true, indexName: 'mock-vectorize' })),
  getRAGCount: vi.fn(),
  searchRAG: vi.fn(),
  addToIndex: vi.fn(),
}));

vi.mock('../src/utils/vectorize.js', () => ({
  vectorizeClient: {
    getStatus: ragHarness.getStatus,
  },
}));

vi.mock('../src/utils/rag.js', () => ({
  getRAGCount: ragHarness.getRAGCount,
  searchRAG: ragHarness.searchRAG,
  addToIndex: ragHarness.addToIndex,
}));

describe('RAG routes', () => {
  let createRagRoutes: typeof import('../src/server/routes/files.js').createRagRoutes;
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    ({ createRagRoutes } = await import('../src/server/routes/files.js'));

    app = express();
    app.use(express.json());
    app.use(
      '/api/v1/rag',
      createRagRoutes({
        getRAGCount: ragHarness.getRAGCount,
        searchRAG: ragHarness.searchRAG,
        addToIndex: ragHarness.addToIndex,
      }),
    );
  });

  it('returns stats from the injected RAG service', async () => {
    ragHarness.getRAGCount.mockResolvedValue(7);

    const response = await request(app).get('/api/v1/rag/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      table: 'memory',
      provider: 'Vectorize + LanceDB',
      status: 'online',
      rowCount: 7,
    }));
    expect(response.body.vectorize).toEqual({
      enabled: true,
      indexName: 'mock-vectorize',
    });
    expect(ragHarness.getRAGCount).toHaveBeenCalledTimes(1);
  });

  it('queries and updates analytics', async () => {
    ragHarness.searchRAG.mockResolvedValue([
      { text: 'sky is blue', path: 'doc-1', score: 0.12 },
    ]);

    const queryResponse = await request(app)
      .get('/api/v1/rag/query')
      .query({ query: 'sky', limit: '2' });

    expect(queryResponse.status).toBe(200);
    expect(ragHarness.searchRAG).toHaveBeenCalledWith('sky', 2);
    expect(queryResponse.body.results).toEqual([
      { text: 'sky is blue', path: 'doc-1', score: 0.12 },
    ]);

    const analyticsResponse = await request(app).get('/api/v1/rag/analytics');

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.success).toBe(true);
    expect(analyticsResponse.body.analytics).toEqual(expect.objectContaining({
      totalSearches: 1,
      averageResults: 1,
      vectorizeEnabled: true,
    }));
    expect(analyticsResponse.body.analytics.lastSearches[0]).toEqual(
      expect.objectContaining({
        query: 'sky',
        results: 1,
      }),
    );
  });

  it('defaults limit to 5 when the limit param is absent', async () => {
    ragHarness.searchRAG.mockResolvedValue([]);

    await request(app).get('/api/v1/rag/query').query({ query: 'sky' });

    expect(ragHarness.searchRAG).toHaveBeenCalledWith('sky', 5);
  });

  it('returns 400 when query is missing', async () => {
    const response = await request(app).get('/api/v1/rag/query');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Query is required' });
  });

  it('ingests with metadata.path when provided', async () => {
    const response = await request(app)
      .post('/api/v1/rag/ingest')
      .send({ text: 'hello world', metadata: { path: 'doc-1' } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', indexed: true });
    expect(ragHarness.addToIndex).toHaveBeenCalledWith('doc-1', 'hello world');
  });

  it('falls back to a generated path when metadata is missing', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    const response = await request(app)
      .post('/api/v1/rag/ingest')
      .send({ text: 'hello world' });

    expect(response.status).toBe(200);
    expect(ragHarness.addToIndex).toHaveBeenCalledWith('manual_1234567890', 'hello world');

    nowSpy.mockRestore();
  });

  it('returns 400 when text is missing', async () => {
    const response = await request(app).post('/api/v1/rag/ingest').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Text is required' });
  });

  it('returns LanceDB as provider when vectorize is disabled', async () => {
    // Exercise the false branch of: enabled ? 'Vectorize + LanceDB' : 'LanceDB'
    ragHarness.getStatus.mockReturnValueOnce({ enabled: false, indexName: 'mock-vectorize' });
    ragHarness.getRAGCount.mockResolvedValue(3);

    const response = await request(app).get('/api/v1/rag/stats');

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('LanceDB');
    expect(response.body.vectorize).toEqual({ enabled: false, indexName: 'mock-vectorize' });
  });

  it('returns 500 when getRAGCount throws', async () => {
    ragHarness.getRAGCount.mockRejectedValueOnce(new Error('db down'));

    const response = await request(app).get('/api/v1/rag/stats');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'db down' });
  });

  it('returns 500 when searchRAG throws', async () => {
    ragHarness.searchRAG.mockRejectedValueOnce(new Error('index offline'));

    const response = await request(app).get('/api/v1/rag/query').query({ query: 'test' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'index offline' });
  });

  it('returns 500 when addToIndex throws', async () => {
    ragHarness.addToIndex.mockRejectedValueOnce(new Error('write failed'));

    const response = await request(app)
      .post('/api/v1/rag/ingest')
      .send({ text: 'content' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'write failed' });
  });
});
