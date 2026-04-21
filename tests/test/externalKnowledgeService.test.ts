import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const externalKnowledgeHarness = vi.hoisted(() => ({
  addToIndex: vi.fn(),
  searchRAG: vi.fn(),
  fireHookSafely: vi.fn(),
}));

vi.mock('../src/utils/rag.js', () => ({
  addToIndex: externalKnowledgeHarness.addToIndex,
  searchRAG: externalKnowledgeHarness.searchRAG,
}));

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHookSafely: externalKnowledgeHarness.fireHookSafely,
}));

import {
  createKnowledgeCard,
  ingestYoutubeSource,
  ingestWebSource,
  initExternalKnowledgeSchema,
  listGovernanceReviewQueue,
  promoteKnowledgeCard,
  searchKnowledgeCards,
} from '../src/server/services/externalKnowledgeService.js';

describe('externalKnowledgeService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initExternalKnowledgeSchema(db);
    vi.clearAllMocks();
    externalKnowledgeHarness.searchRAG.mockResolvedValue([]);
    externalKnowledgeHarness.fireHookSafely.mockResolvedValue(null);
  });

  afterEach(() => {
    db.close();
  });

  it('ingests web content into screened source and chunk rows', async () => {
    const source = await ingestWebSource(
      {
        url: 'https://example.com/article',
        title: 'Example Article',
        content: 'First sentence. Second sentence. Third sentence.',
        tags: ['nova', 'rag'],
      },
      { db },
    );

    expect(source.status).toBe('screened');
    expect(source.chunkCount).toBeGreaterThan(0);
    expect(source.tags).toEqual(['nova', 'rag']);

    const chunks = db.prepare('SELECT COUNT(*) as count FROM external_knowledge_chunks WHERE source_id = ?').get(source.id) as { count: number };
    expect(chunks.count).toBe(source.chunkCount);
    expect(externalKnowledgeHarness.fireHookSafely).toHaveBeenCalledWith(
      'knowledge.source.ingested',
      expect.objectContaining({ sourceId: source.id, sourceType: 'web' }),
      expect.objectContaining({ source: 'external-knowledge' }),
    );
  });

  it('deduplicates repeated web ingest payloads by source hash', async () => {
    const first = await ingestWebSource(
      {
        url: 'https://example.com/repeat',
        content: 'Repeated text for dedupe.',
      },
      { db },
    );

    const second = await ingestWebSource(
      {
        url: 'https://example.com/repeat',
        content: 'Repeated text for dedupe.',
      },
      { db },
    );

    expect(second.id).toBe(first.id);
    expect(second.deduplicated).toBe(true);

    const count = db.prepare('SELECT COUNT(*) as count FROM external_knowledge_sources').get() as { count: number };
    expect(count.count).toBe(1);
  });

  it('creates provisional knowledge cards from screened sources', async () => {
    const source = await ingestYoutubeSource(
      {
        url: 'https://youtube.com/watch?v=123',
        title: 'Knowledge video',
        transcript: 'Brunella can stage external knowledge before promotion.',
        tags: ['youtube'],
      },
      { db },
    );

    const card = createKnowledgeCard(
      {
        sourceIds: [source.id],
        title: 'Staged knowledge',
        summary: 'External knowledge must stay provisional first.',
        claims: ['External knowledge is staged.', 'Promotion is explicit.'],
        tags: ['governance'],
      },
      { db },
    );

    expect(card.status).toBe('provisional');
    expect(card.sourceIds).toEqual([source.id]);

    const queue = listGovernanceReviewQueue({ db, limit: 10 });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.id).toBe(card.id);
  });

  it('rejects knowledge cards that reference missing sources', () => {
    expect(() =>
      createKnowledgeCard(
        {
          sourceIds: ['missing-source'],
          summary: 'Nope',
          claims: ['Missing sources should fail.'],
        },
        { db },
      ),
    ).toThrow('do not exist');
  });

  it('requires reviewer note for single-source promotion', async () => {
    const source = await ingestWebSource(
      {
        url: 'https://example.com/single-source',
        content: 'Single source content.',
      },
      { db },
    );
    const card = createKnowledgeCard(
      {
        sourceIds: [source.id],
        summary: 'Single source provisional card.',
        claims: ['Single source cards need explicit approval.'],
      },
      { db },
    );

    await expect(
      promoteKnowledgeCard(card.id, { db, reviewer: 'Copilot' }),
    ).rejects.toThrow('Single-source promotion requires an explicit reviewer note');
  });

  it('promotes provisional cards and indexes only canonical retrieval text', async () => {
    const sourceA = await ingestWebSource(
      {
        url: 'https://example.com/a',
        content: 'Source A text for card.',
      },
      { db },
    );
    const sourceB = await ingestWebSource(
      {
        url: 'https://example.com/b',
        content: 'Source B confirms the same thing.',
      },
      { db },
    );

    const card = createKnowledgeCard(
      {
        sourceIds: [sourceA.id, sourceB.id],
        title: 'Canonical card',
        summary: 'Two sources support promotion.',
        claims: ['Two-source cards can be promoted after review.'],
        evidence: ['Source A', 'Source B'],
      },
      { db },
    );

    const promoted = await promoteKnowledgeCard(card.id, {
      db,
      reviewer: 'Copilot',
      note: 'Cross-checked against two independent sources.',
    });

    expect(promoted.status).toBe('canonical');
    expect(promoted.promotedBy).toBe('Copilot');
    expect(externalKnowledgeHarness.addToIndex).toHaveBeenCalledWith(
      `knowledge_card:${card.id}`,
      expect.stringContaining('Canonical card'),
    );
    expect(externalKnowledgeHarness.fireHookSafely).toHaveBeenCalledWith(
      'knowledge.card.promoted',
      expect.objectContaining({ cardId: card.id, reviewer: 'Copilot' }),
      expect.objectContaining({ source: 'external-knowledge' }),
    );
  });

  it('searches canonical cards with keyword and semantic matches', async () => {
    const sourceA = await ingestWebSource(
      {
        url: 'https://example.com/search-a',
        content: 'Brunella watches external sources and canonicalizes them.',
      },
      { db },
    );
    const sourceB = await ingestWebSource(
      {
        url: 'https://example.com/search-b',
        content: 'Canonical knowledge cards improve retrieval.',
      },
      { db },
    );

    const card = createKnowledgeCard(
      {
        sourceIds: [sourceA.id, sourceB.id],
        title: 'External knowledge pipeline',
        summary: 'Canonical cards improve retrieval quality.',
        claims: ['Canonical cards improve retrieval quality.'],
      },
      { db },
    );

    await promoteKnowledgeCard(card.id, {
      db,
      reviewer: 'Copilot',
      note: 'Two-source review complete.',
    });

    externalKnowledgeHarness.searchRAG.mockResolvedValueOnce([
      { path: `knowledge_card:${card.id}`, score: 0.12, text: 'retrieval quality' },
    ]);

    const results = await searchKnowledgeCards({ query: 'retrieval quality', limit: 10 }, { db });
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: card.id, match: expect.stringMatching(/keyword|semantic|hybrid/) }),
      ]),
    );
  });
});
