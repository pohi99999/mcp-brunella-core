import Database from 'better-sqlite3';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toolHarness = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  addToIndex: vi.fn(),
  searchRAG: vi.fn(),
  fireHookSafely: vi.fn(),
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: () => toolHarness.db,
}));

vi.mock('@packages/utils/rag.js', () => ({
  addToIndex: toolHarness.addToIndex,
  searchRAG: toolHarness.searchRAG,
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHookSafely: toolHarness.fireHookSafely,
}));

import { initExternalKnowledgeSchema } from '@apps/mcp-core/server/services/externalKnowledgeService.js';
import {
  governanceReviewQueueHandler,
  knowledgeCardSearchHandler,
  knowledgeCreateCardHandler,
  knowledgePromoteHandler,
  sourceIngestWebHandler,
  sourceIngestYoutubeHandler,
} from '@packages/utils/externalKnowledge.js';

describe('externalKnowledge tool handlers', () => {
  beforeEach(() => {
    toolHarness.db = new Database(':memory:');
    initExternalKnowledgeSchema(toolHarness.db);
    vi.clearAllMocks();
    toolHarness.searchRAG.mockResolvedValue([]);
    toolHarness.fireHookSafely.mockResolvedValue(null);
  });

  afterAll(() => {
    toolHarness.db.close();
  });

  it('ingests web sources through the handler', async () => {
    const result = await sourceIngestWebHandler({
      url: 'https://example.com/tool-web',
      content: 'Tool handler web content.',
      tags: ['tool'],
    });

    expect(result.success).toBe(true);
    expect(result.source).toEqual(expect.objectContaining({ status: 'screened' }));
  });

  it('ingests youtube transcript payloads through the handler', async () => {
    const result = await sourceIngestYoutubeHandler({
      url: 'https://youtube.com/watch?v=tool',
      transcript: 'Tool handler youtube transcript.',
      tags: ['youtube'],
    });

    expect(result.success).toBe(true);
    expect(result.source).toEqual(expect.objectContaining({ sourceType: 'youtube' }));
  });

  it('creates and promotes a card through handlers', async () => {
    const sourceA = await sourceIngestWebHandler({
      url: 'https://example.com/card-a',
      content: 'Source A content.',
    });
    const sourceB = await sourceIngestWebHandler({
      url: 'https://example.com/card-b',
      content: 'Source B content.',
    });

    const sourceIds = [
      (sourceA.source as { id: string }).id,
      (sourceB.source as { id: string }).id,
    ];

    const card = await knowledgeCreateCardHandler({
      source_ids: sourceIds,
      summary: 'Tool-created card.',
      claims: ['Tool-created card.'],
    });

    expect(card.success).toBe(true);

    const promoted = await knowledgePromoteHandler({
      card_id: (card.card as { id: string }).id,
      reviewer: 'Copilot',
      note: 'Reviewed in tool test.',
    });

    expect(promoted.success).toBe(true);
    expect(promoted.card).toEqual(expect.objectContaining({ status: 'canonical' }));
  });

  it('lists the review queue and searches cards', async () => {
    const source = await sourceIngestWebHandler({
      url: 'https://example.com/searchable',
      content: 'Searchable content for tools.',
    });

    const created = await knowledgeCreateCardHandler({
      source_ids: [(source.source as { id: string }).id],
      summary: 'Searchable provisional tool card.',
      claims: ['Searchable provisional tool card.'],
    });

    const queue = await governanceReviewQueueHandler({ limit: 5 });
    expect(queue.success).toBe(true);
    expect(queue.items).toHaveLength(1);

    toolHarness.searchRAG.mockResolvedValueOnce([
      { path: `knowledge_card:${(created.card as { id: string }).id}`, score: 0.1, text: 'searchable' },
    ]);

    const search = await knowledgeCardSearchHandler({
      query: 'searchable',
      include_provisional: true,
      limit: 5,
    });

    expect(search.success).toBe(true);
    expect(search.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: (created.card as { id: string }).id }),
      ]),
    );
  });
});
