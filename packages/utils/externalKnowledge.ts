import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  createKnowledgeCard,
  listGovernanceReviewQueue,
  promoteKnowledgeCard,
  safeIngestWebSource,
  safeIngestYoutubeSource,
  searchKnowledgeCards,
} from '@packages/core-logic/services/externalKnowledgeService.js';
import { getGlobalDb } from '@packages/utils/globalDb.js';
import { logError, logInfo } from '@packages/utils/logger.js';

export async function sourceIngestWebHandler(params: {
  url: string;
  title?: string;
  content?: string;
  author?: string;
  published_at?: string;
  language?: string;
  tags?: string[];
}): Promise<{ success: boolean; source?: unknown; error?: string }> {
  try {
    const source = await safeIngestWebSource(
      {
        url: params.url,
        title: params.title,
        content: params.content,
        author: params.author,
        publishedAt: params.published_at,
        language: params.language,
        tags: params.tags,
      },
      { db: getGlobalDb() },
    );
    return { success: true, source };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

export async function sourceIngestYoutubeHandler(params: {
  url: string;
  title?: string;
  transcript: string;
  channel?: string;
  published_at?: string;
  language?: string;
  tags?: string[];
}): Promise<{ success: boolean; source?: unknown; error?: string }> {
  try {
    const source = await safeIngestYoutubeSource(
      {
        url: params.url,
        title: params.title,
        transcript: params.transcript,
        channel: params.channel,
        publishedAt: params.published_at,
        language: params.language,
        tags: params.tags,
      },
      { db: getGlobalDb() },
    );
    return { success: true, source };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

export async function knowledgeCreateCardHandler(params: {
  source_ids: string[];
  title?: string;
  summary: string;
  claims: string[];
  evidence?: string[];
  tags?: string[];
  entities?: string[];
  confidence?: number;
  scores?: Record<string, number>;
}): Promise<{ success: boolean; card?: unknown; error?: string }> {
  try {
    const card = createKnowledgeCard(
      {
        sourceIds: params.source_ids,
        title: params.title,
        summary: params.summary,
        claims: params.claims,
        evidence: params.evidence,
        tags: params.tags,
        entities: params.entities,
        confidence: params.confidence,
        scores: params.scores,
      },
      { db: getGlobalDb() },
    );
    return { success: true, card };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

export async function governanceReviewQueueHandler(params: {
  limit?: number;
} = {}): Promise<{ success: boolean; items?: unknown[]; error?: string }> {
  try {
    const items = listGovernanceReviewQueue({ db: getGlobalDb(), limit: params.limit });
    return { success: true, items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

export async function knowledgePromoteHandler(params: {
  card_id: string;
  reviewer: string;
  note?: string;
}): Promise<{ success: boolean; card?: unknown; error?: string }> {
  try {
    const card = await promoteKnowledgeCard(params.card_id, {
      db: getGlobalDb(),
      reviewer: params.reviewer,
      note: params.note,
    });
    return { success: true, card };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

export async function knowledgeCardSearchHandler(params: {
  query: string;
  limit?: number;
  include_provisional?: boolean;
}): Promise<{ success: boolean; results?: unknown[]; error?: string }> {
  try {
    const results = await searchKnowledgeCards(
      {
        query: params.query,
        limit: params.limit,
        includeProvisional: params.include_provisional,
      },
      { db: getGlobalDb() },
    );
    return { success: true, results };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ExternalKnowledgeTool', message);
    return { success: false, error: message };
  }
}

function asText(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

export function registerExternalKnowledgeTools(server: McpServer): void {
  logInfo('ExternalKnowledgeTool', 'Registering staged external knowledge tools.');

  server.tool(
    'source_ingest_web',
    'Ingests a web source into staged external knowledge memory. Raw external content is screened and chunked before any card promotion.',
    {
      url: z.string().url(),
      title: z.string().optional(),
      content: z.string().optional(),
      author: z.string().optional(),
      published_at: z.string().optional(),
      language: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = await sourceIngestWebHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.source : result) }],
      };
    },
  );

  server.tool(
    'source_ingest_youtube',
    'Ingests a YouTube transcript payload into staged external knowledge memory. The transcript stays screened until promoted via a knowledge card workflow.',
    {
      url: z.string().url(),
      title: z.string().optional(),
      transcript: z.string().min(1),
      channel: z.string().optional(),
      published_at: z.string().optional(),
      language: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = await sourceIngestYoutubeHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.source : result) }],
      };
    },
  );

  server.tool(
    'knowledge_create_card',
    'Creates a provisional knowledge card from screened sources. Cards are not indexed into canonical retrieval until promotion succeeds.',
    {
      source_ids: z.array(z.string()).min(1),
      title: z.string().optional(),
      summary: z.string().min(1),
      claims: z.array(z.string()).min(1),
      evidence: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      entities: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
      scores: z.record(z.string(), z.number().min(0).max(1)).optional(),
    },
    async (args) => {
      const result = await knowledgeCreateCardHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.card : result) }],
      };
    },
  );

  server.tool(
    'governance_review_queue',
    'Returns provisional knowledge cards waiting for human/governance review.',
    {
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
    async (args) => {
      const result = await governanceReviewQueueHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.items : result) }],
      };
    },
  );

  server.tool(
    'knowledge_promote',
    'Promotes a provisional knowledge card to canonical status after reviewer approval. Canonical cards are then indexed for retrieval.',
    {
      card_id: z.string(),
      reviewer: z.string().min(1),
      note: z.string().optional(),
    },
    async (args) => {
      const result = await knowledgePromoteHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.card : result) }],
      };
    },
  );

  server.tool(
    'knowledge_card_search',
    'Searches canonical knowledge cards using keyword and semantic retrieval. Raw or screened source text is never returned directly.',
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(25).optional().default(10),
      include_provisional: z.boolean().optional().default(false),
    },
    async (args) => {
      const result = await knowledgeCardSearchHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.results : result) }],
      };
    },
  );
}

