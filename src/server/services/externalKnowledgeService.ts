import { createHash, randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

import { fireHookSafely } from '../../core/hookRegistry.js';
import { ensureError } from '../../utils/ensureError.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';
import { addToIndex, searchRAG } from '../../utils/rag.js';

const MODULE = 'ExternalKnowledgeService';
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_CHUNK_SIZE = 1_400;
const DEFAULT_REVIEW_LIMIT = 20;

export type ExternalKnowledgeSourceType = 'web' | 'youtube';
export type ExternalKnowledgeSourceStatus = 'raw' | 'screened' | 'deprecated';
export type KnowledgeCardStatus = 'provisional' | 'canonical' | 'deprecated';

export interface ExternalKnowledgeSourceSummary {
  id: string;
  sourceType: ExternalKnowledgeSourceType;
  status: ExternalKnowledgeSourceStatus;
  sourceUrl: string;
  title: string;
  author?: string;
  retrievedAt: string;
  publishedAt?: string;
  language?: string;
  chunkCount: number;
  tags: string[];
  deduplicated: boolean;
}

export interface IngestWebSourceInput {
  url: string;
  title?: string;
  content?: string;
  author?: string;
  publishedAt?: string;
  language?: string;
  tags?: string[];
}

export interface IngestYoutubeSourceInput {
  url: string;
  title?: string;
  transcript: string;
  channel?: string;
  publishedAt?: string;
  language?: string;
  tags?: string[];
}

export interface KnowledgeCardScoreSet {
  relevance?: number;
  trust?: number;
  freshness?: number;
  novelty?: number;
  actionability?: number;
  conflictRisk?: number;
}

export interface CreateKnowledgeCardInput {
  sourceIds: string[];
  title?: string;
  summary: string;
  claims: string[];
  evidence?: string[];
  tags?: string[];
  entities?: string[];
  scores?: KnowledgeCardScoreSet;
  confidence?: number;
}

export interface KnowledgeCardSummary {
  id: string;
  title: string;
  status: KnowledgeCardStatus;
  summary: string;
  claims: string[];
  evidence: string[];
  tags: string[];
  entities: string[];
  sourceIds: string[];
  sourceCount: number;
  scores: KnowledgeCardScoreSet;
  confidence: number;
  promotedBy?: string;
  promotedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueItem extends KnowledgeCardSummary {}

export interface SearchKnowledgeCardsInput {
  query: string;
  limit?: number;
  includeProvisional?: boolean;
}

export interface SearchKnowledgeCardResult {
  id: string;
  title: string;
  status: KnowledgeCardStatus;
  summary: string;
  sourceCount: number;
  confidence: number;
  tags: string[];
  match: 'keyword' | 'semantic' | 'hybrid';
  semanticScore?: number;
}

interface ExternalKnowledgeSourceRow {
  id: string;
  source_type: ExternalKnowledgeSourceType;
  status: ExternalKnowledgeSourceStatus;
  source_url: string;
  title: string;
  author: string | null;
  retrieved_at: string;
  published_at: string | null;
  language: string | null;
  raw_text: string;
  normalized_text: string;
  metadata_json: string;
  source_hash: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeCardRow {
  id: string;
  title: string;
  status: KnowledgeCardStatus;
  summary: string;
  claims_json: string;
  evidence_json: string;
  tags_json: string;
  entities_json: string;
  source_refs_json: string;
  scores_json: string;
  confidence: number;
  review_note: string | null;
  promoted_by: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ChunkInsertRow {
  id: string;
  source_id: string;
  chunk_index: number;
  text: string;
  token_estimate: number;
  metadata_json: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(db?: Database.Database): Database.Database {
  return db ?? getGlobalDb();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, '').replace(/\t/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractTextFromHtml(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const text = normalizeWhitespace(
    decodeBasicHtmlEntities(withoutScripts.replace(/<[^>]+>/g, ' ')),
  );

  return {
    title: titleMatch ? normalizeWhitespace(decodeBasicHtmlEntities(titleMatch[1])) : undefined,
    text,
  };
}

function sanitizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => normalizeWhitespace(String(tag)))
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 20);
}

function sanitizeStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(String(value)))
        .filter((value) => value.length > 0),
    ),
  );
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function hashSource(sourceType: ExternalKnowledgeSourceType, url: string, normalizedText: string): string {
  return createHash('sha256')
    .update(`${sourceType}|${normalizeWhitespace(url)}|${normalizedText.slice(0, 24_000)}`)
    .digest('hex');
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeWhitespace(String(item))).filter((item) => item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined): T {
  if (!value) {
    return {} as T;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
  } catch {
    return {} as T;
  }
}

function splitIntoChunks(text: string, maxLength = DEFAULT_CHUNK_SIZE): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 1) <= maxLength) {
      current = `${current} ${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) {
      return [chunk];
    }

    const parts: string[] = [];
    let remaining = chunk;
    while (remaining.length > maxLength) {
      parts.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength).trim();
    }
    if (remaining) {
      parts.push(remaining);
    }
    return parts;
  });
}

function clampScore(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeScores(scores?: KnowledgeCardScoreSet): KnowledgeCardScoreSet {
  return {
    relevance: clampScore(scores?.relevance),
    trust: clampScore(scores?.trust),
    freshness: clampScore(scores?.freshness),
    novelty: clampScore(scores?.novelty),
    actionability: clampScore(scores?.actionability),
    conflictRisk: clampScore(scores?.conflictRisk),
  };
}

function inferConfidence(scores: KnowledgeCardScoreSet, explicit?: number): number {
  const clampedExplicit = clampScore(explicit);
  if (typeof clampedExplicit === 'number') {
    return clampedExplicit;
  }

  const numeric = Object.values(scores).filter((value): value is number => typeof value === 'number');
  if (numeric.length === 0) {
    return 0.5;
  }

  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return Number(average.toFixed(3));
}

function sourceRowToSummary(row: ExternalKnowledgeSourceRow, chunkCount: number, deduplicated: boolean): ExternalKnowledgeSourceSummary {
  const metadata = parseJsonObject<{ tags?: string[] }>(row.metadata_json);
  return {
    id: row.id,
    sourceType: row.source_type,
    status: row.status,
    sourceUrl: row.source_url,
    title: row.title,
    author: row.author ?? undefined,
    retrievedAt: row.retrieved_at,
    publishedAt: row.published_at ?? undefined,
    language: row.language ?? undefined,
    chunkCount,
    tags: sanitizeTags(metadata.tags),
    deduplicated,
  };
}

function cardRowToSummary(row: KnowledgeCardRow): KnowledgeCardSummary {
  const claims = parseJsonArray(row.claims_json);
  const evidence = parseJsonArray(row.evidence_json);
  const tags = parseJsonArray(row.tags_json);
  const entities = parseJsonArray(row.entities_json);
  const sourceIds = parseJsonArray(row.source_refs_json);
  const scores = parseJsonObject<KnowledgeCardScoreSet>(row.scores_json);

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    summary: row.summary,
    claims,
    evidence,
    tags,
    entities,
    sourceIds,
    sourceCount: sourceIds.length,
    scores,
    confidence: row.confidence,
    promotedBy: row.promoted_by ?? undefined,
    promotedAt: row.promoted_at ?? undefined,
    reviewNote: row.review_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchWebText(url: string, fetcher: typeof fetch = fetch): Promise<{ title?: string; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'BrunellaKnowledgeIngest/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  } finally {
    clearTimeout(timeout);
  }
}

function buildChunkRows(sourceId: string, chunks: string[], sourceType: ExternalKnowledgeSourceType): ChunkInsertRow[] {
  return chunks.map((chunk, index) => ({
    id: randomUUID(),
    source_id: sourceId,
    chunk_index: index,
    text: chunk,
    token_estimate: estimateTokens(chunk),
    metadata_json: JSON.stringify({ sourceType, chunkIndex: index }),
  }));
}

function buildRetrievalText(card: KnowledgeCardSummary): string {
  const parts = [
    `Title: ${card.title}`,
    `Summary: ${card.summary}`,
    `Claims: ${card.claims.join(' | ')}`,
    `Evidence: ${card.evidence.join(' | ')}`,
    `Tags: ${card.tags.join(', ')}`,
    `Status: ${card.status}`,
  ];
  return parts.filter(Boolean).join('\n');
}

export function initExternalKnowledgeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_knowledge_sources (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL CHECK (source_type IN ('web', 'youtube')),
      status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'screened', 'deprecated')),
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      retrieved_at TEXT NOT NULL,
      published_at TEXT,
      language TEXT,
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      source_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS external_knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_id) REFERENCES external_knowledge_sources(id) ON DELETE CASCADE,
      UNIQUE(source_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'canonical', 'deprecated')),
      summary TEXT NOT NULL,
      claims_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      entities_json TEXT NOT NULL DEFAULT '[]',
      source_refs_json TEXT NOT NULL,
      scores_json TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 0.5,
      review_note TEXT,
      promoted_by TEXT,
      promoted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_external_knowledge_sources_status
      ON external_knowledge_sources(status);

    CREATE INDEX IF NOT EXISTS idx_external_knowledge_sources_type
      ON external_knowledge_sources(source_type);

    CREATE INDEX IF NOT EXISTS idx_external_knowledge_cards_status
      ON knowledge_cards(status);

    CREATE INDEX IF NOT EXISTS idx_external_knowledge_cards_created_at
      ON knowledge_cards(created_at);
  `);
}

export async function ingestWebSource(
  input: IngestWebSourceInput,
  options: { db?: Database.Database; fetcher?: typeof fetch } = {},
): Promise<ExternalKnowledgeSourceSummary> {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);

  const url = normalizeWhitespace(input.url);
  if (!url) {
    throw new Error('Web ingest requires a URL.');
  }

  let text = normalizeWhitespace(input.content ?? '');
  let resolvedTitle = normalizeWhitespace(input.title ?? '');

  if (!text) {
    const fetched = await fetchWebText(url, options.fetcher);
    text = normalizeWhitespace(fetched.text);
    if (!resolvedTitle) {
      resolvedTitle = normalizeWhitespace(fetched.title ?? '');
    }
  }

  if (!text) {
    throw new Error('No extractable web content found. Provide content explicitly or use a reachable URL.');
  }

  const normalizedText = normalizeWhitespace(text);
  const sourceHash = hashSource('web', url, normalizedText);
  const existing = db.prepare('SELECT * FROM external_knowledge_sources WHERE source_hash = ?').get(sourceHash) as ExternalKnowledgeSourceRow | undefined;
  if (existing) {
    const chunkCountRow = db.prepare('SELECT COUNT(*) as count FROM external_knowledge_chunks WHERE source_id = ?').get(existing.id) as { count: number };
    return sourceRowToSummary(existing, chunkCountRow.count, true);
  }

  const sourceId = randomUUID();
  const tags = sanitizeTags(input.tags);
  const retrievedAt = nowIso();
  const chunks = splitIntoChunks(normalizedText);
  if (chunks.length === 0) {
    throw new Error('Web ingest produced zero chunks after normalization.');
  }

  const insertSource = db.prepare(`
    INSERT INTO external_knowledge_sources (
      id, source_type, status, source_url, title, author, retrieved_at, published_at, language,
      raw_text, normalized_text, metadata_json, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChunk = db.prepare(`
    INSERT INTO external_knowledge_chunks (id, source_id, chunk_index, text, token_estimate, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertSource.run(
      sourceId,
      'web',
      'raw',
      url,
      resolvedTitle || url,
      normalizeWhitespace(input.author ?? '') || null,
      retrievedAt,
      normalizeWhitespace(input.publishedAt ?? '') || null,
      normalizeWhitespace(input.language ?? '') || null,
      text,
      normalizedText,
      JSON.stringify({ tags }),
      sourceHash,
    );

    for (const row of buildChunkRows(sourceId, chunks, 'web')) {
      insertChunk.run(row.id, row.source_id, row.chunk_index, row.text, row.token_estimate, row.metadata_json);
    }

    db.prepare('UPDATE external_knowledge_sources SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('screened', sourceId);
  });

  transaction();

  await fireHookSafely(
    'knowledge.source.ingested',
    { sourceId, sourceType: 'web', sourceUrl: url, chunkCount: chunks.length, tags },
    { source: 'external-knowledge', metadata: { sourceType: 'web' }, logContext: MODULE },
  );

  const inserted = db.prepare('SELECT * FROM external_knowledge_sources WHERE id = ?').get(sourceId) as ExternalKnowledgeSourceRow;
  logInfo(MODULE, `Web source ingested: ${url} (${chunks.length} chunks)`);
  return sourceRowToSummary(inserted, chunks.length, false);
}

export async function ingestYoutubeSource(
  input: IngestYoutubeSourceInput,
  options: { db?: Database.Database } = {},
): Promise<ExternalKnowledgeSourceSummary> {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);

  const url = normalizeWhitespace(input.url);
  const transcript = normalizeWhitespace(input.transcript);
  if (!url || !transcript) {
    throw new Error('YouTube ingest requires both a URL and a transcript payload.');
  }

  const sourceHash = hashSource('youtube', url, transcript);
  const existing = db.prepare('SELECT * FROM external_knowledge_sources WHERE source_hash = ?').get(sourceHash) as ExternalKnowledgeSourceRow | undefined;
  if (existing) {
    const chunkCountRow = db.prepare('SELECT COUNT(*) as count FROM external_knowledge_chunks WHERE source_id = ?').get(existing.id) as { count: number };
    return sourceRowToSummary(existing, chunkCountRow.count, true);
  }

  const sourceId = randomUUID();
  const tags = sanitizeTags(input.tags);
  const chunks = splitIntoChunks(transcript);
  const retrievedAt = nowIso();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO external_knowledge_sources (
        id, source_type, status, source_url, title, author, retrieved_at, published_at, language,
        raw_text, normalized_text, metadata_json, source_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceId,
      'youtube',
      'screened',
      url,
      normalizeWhitespace(input.title ?? '') || url,
      normalizeWhitespace(input.channel ?? '') || null,
      retrievedAt,
      normalizeWhitespace(input.publishedAt ?? '') || null,
      normalizeWhitespace(input.language ?? '') || null,
      transcript,
      transcript,
      JSON.stringify({ tags }),
      sourceHash,
    );

    const insertChunk = db.prepare(`
      INSERT INTO external_knowledge_chunks (id, source_id, chunk_index, text, token_estimate, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const row of buildChunkRows(sourceId, chunks, 'youtube')) {
      insertChunk.run(row.id, row.source_id, row.chunk_index, row.text, row.token_estimate, row.metadata_json);
    }
  });

  transaction();

  await fireHookSafely(
    'knowledge.source.ingested',
    { sourceId, sourceType: 'youtube', sourceUrl: url, chunkCount: chunks.length, tags },
    { source: 'external-knowledge', metadata: { sourceType: 'youtube' }, logContext: MODULE },
  );

  const inserted = db.prepare('SELECT * FROM external_knowledge_sources WHERE id = ?').get(sourceId) as ExternalKnowledgeSourceRow;
  logInfo(MODULE, `YouTube source ingested: ${url} (${chunks.length} chunks)`);
  return sourceRowToSummary(inserted, chunks.length, false);
}

export function createKnowledgeCard(
  input: CreateKnowledgeCardInput,
  options: { db?: Database.Database } = {},
): KnowledgeCardSummary {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);

  const sourceIds = sanitizeStringArray(input.sourceIds);
  const claims = sanitizeStringArray(input.claims);
  const evidence = sanitizeStringArray(input.evidence);
  const tags = sanitizeTags(input.tags);
  const entities = sanitizeStringArray(input.entities);
  const summary = normalizeWhitespace(input.summary);

  if (sourceIds.length === 0) {
    throw new Error('Knowledge cards require at least one screened source.');
  }
  if (!summary) {
    throw new Error('Knowledge cards require a summary.');
  }
  if (claims.length === 0) {
    throw new Error('Knowledge cards require at least one claim.');
  }

  const placeholders = sourceIds.map(() => '?').join(', ');
  const sourceRows = db.prepare(`SELECT * FROM external_knowledge_sources WHERE id IN (${placeholders})`).all(...sourceIds) as ExternalKnowledgeSourceRow[];
  if (sourceRows.length !== sourceIds.length) {
    throw new Error('One or more referenced sources do not exist.');
  }

  const invalidSource = sourceRows.find((row) => row.status !== 'screened');
  if (invalidSource) {
    throw new Error(`Source ${invalidSource.id} is not screened and cannot seed a knowledge card.`);
  }

  const scores = normalizeScores(input.scores);
  const confidence = inferConfidence(scores, input.confidence);
  const title = normalizeWhitespace(input.title ?? '') || sourceRows[0]?.title || `Knowledge card ${new Date().toISOString().slice(0, 10)}`;
  const cardId = randomUUID();

  db.prepare(`
    INSERT INTO knowledge_cards (
      id, title, status, summary, claims_json, evidence_json, tags_json, entities_json,
      source_refs_json, scores_json, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cardId,
    title,
    'provisional',
    summary,
    JSON.stringify(claims),
    JSON.stringify(evidence),
    JSON.stringify(tags),
    JSON.stringify(entities),
    JSON.stringify(sourceIds),
    JSON.stringify(scores),
    confidence,
  );

  void fireHookSafely(
    'knowledge.card.created',
    { cardId, title, sourceCount: sourceIds.length, confidence },
    { source: 'external-knowledge', metadata: { status: 'provisional' }, logContext: MODULE },
  );

  const inserted = db.prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(cardId) as KnowledgeCardRow;
  logInfo(MODULE, `Knowledge card created: ${cardId} (${sourceIds.length} sources)`);
  return cardRowToSummary(inserted);
}

export function listGovernanceReviewQueue(
  options: { db?: Database.Database; limit?: number } = {},
): ReviewQueueItem[] {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);
  const limit = Math.max(1, Math.min(100, options.limit ?? DEFAULT_REVIEW_LIMIT));

  const rows = db.prepare(`
    SELECT * FROM knowledge_cards
    WHERE status = 'provisional'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as KnowledgeCardRow[];

  return rows.map(cardRowToSummary);
}

export async function promoteKnowledgeCard(
  cardId: string,
  options: { db?: Database.Database; reviewer: string; note?: string } ,
): Promise<KnowledgeCardSummary> {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);

  const reviewer = normalizeWhitespace(options.reviewer);
  const note = normalizeWhitespace(options.note ?? '');
  if (!reviewer) {
    throw new Error('Knowledge promotion requires a reviewer identity.');
  }

  const row = db.prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(cardId) as KnowledgeCardRow | undefined;
  if (!row) {
    throw new Error(`Knowledge card not found: ${cardId}`);
  }
  if (row.status === 'canonical') {
    return cardRowToSummary(row);
  }
  if (row.status !== 'provisional') {
    throw new Error(`Only provisional cards can be promoted (current status: ${row.status}).`);
  }

  const sourceIds = parseJsonArray(row.source_refs_json);
  if (sourceIds.length === 0) {
    throw new Error('Knowledge cards without source references cannot be promoted.');
  }
  if (sourceIds.length < 2 && !note) {
    throw new Error('Single-source promotion requires an explicit reviewer note/human approval rationale.');
  }

  db.prepare(`
    UPDATE knowledge_cards
    SET status = 'canonical', promoted_by = ?, promoted_at = ?, review_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(reviewer, nowIso(), note || null, cardId);

  const promotedRow = db.prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(cardId) as KnowledgeCardRow;
  const summary = cardRowToSummary(promotedRow);
  await addToIndex(`knowledge_card:${summary.id}`, buildRetrievalText(summary));

  await fireHookSafely(
    'knowledge.card.promoted',
    { cardId: summary.id, reviewer, sourceCount: summary.sourceCount },
    { source: 'external-knowledge', metadata: { reviewer }, logContext: MODULE },
  );

  logInfo(MODULE, `Knowledge card promoted: ${summary.id}`);
  return summary;
}

function loadCardsByIds(db: Database.Database, ids: string[]): KnowledgeCardSummary[] {
  if (ids.length === 0) {
    return [];
  }
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db.prepare(`SELECT * FROM knowledge_cards WHERE id IN (${placeholders})`).all(...ids) as KnowledgeCardRow[];
  return rows.map(cardRowToSummary);
}

export async function searchKnowledgeCards(
  input: SearchKnowledgeCardsInput,
  options: { db?: Database.Database } = {},
): Promise<SearchKnowledgeCardResult[]> {
  const db = getDb(options.db);
  initExternalKnowledgeSchema(db);

  const query = normalizeWhitespace(input.query);
  if (!query) {
    return [];
  }

  const limit = Math.max(1, Math.min(25, input.limit ?? 10));
  const statuses = input.includeProvisional ? ['canonical', 'provisional'] : ['canonical'];
  const statusPlaceholders = statuses.map(() => '?').join(', ');
  const like = `%${query.toLowerCase()}%`;

  const keywordRows = db.prepare(`
    SELECT * FROM knowledge_cards
    WHERE status IN (${statusPlaceholders})
      AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(...statuses, like, like, limit) as KnowledgeCardRow[];

  const results = new Map<string, SearchKnowledgeCardResult>();
  for (const row of keywordRows) {
    const summary = cardRowToSummary(row);
    results.set(summary.id, {
      id: summary.id,
      title: summary.title,
      status: summary.status,
      summary: summary.summary,
      sourceCount: summary.sourceCount,
      confidence: summary.confidence,
      tags: summary.tags,
      match: 'keyword',
    });
  }

  try {
    const semanticHits = await searchRAG(query, limit * 3);
    const semanticIds = semanticHits
      .map((hit) => hit.path ?? '')
      .filter((path) => path.startsWith('knowledge_card:'))
      .map((path) => path.replace('knowledge_card:', ''));

    const semanticCards = loadCardsByIds(db, Array.from(new Set(semanticIds)));
    const semanticById = new Map(semanticCards.map((card) => [card.id, card]));

    for (const hit of semanticHits) {
      const path = hit.path ?? '';
      if (!path.startsWith('knowledge_card:')) {
        continue;
      }

      const cardId = path.replace('knowledge_card:', '');
      const card = semanticById.get(cardId);
      if (!card || !statuses.includes(card.status)) {
        continue;
      }

      const existing = results.get(card.id);
      results.set(card.id, {
        id: card.id,
        title: card.title,
        status: card.status,
        summary: card.summary,
        sourceCount: card.sourceCount,
        confidence: card.confidence,
        tags: card.tags,
        match: existing ? 'hybrid' : 'semantic',
        semanticScore: hit.score,
      });
    }
  } catch (error: unknown) {
    logWarn(MODULE, `Semantic search fallback: ${ensureError(error).message}`);
  }

  return Array.from(results.values()).slice(0, limit);
}

export function getKnowledgeCard(db: Database.Database, cardId: string): KnowledgeCardSummary | null {
  initExternalKnowledgeSchema(db);
  const row = db.prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(cardId) as KnowledgeCardRow | undefined;
  return row ? cardRowToSummary(row) : null;
}

export function getSourceById(db: Database.Database, sourceId: string): ExternalKnowledgeSourceSummary | null {
  initExternalKnowledgeSchema(db);
  const row = db.prepare('SELECT * FROM external_knowledge_sources WHERE id = ?').get(sourceId) as ExternalKnowledgeSourceRow | undefined;
  if (!row) {
    return null;
  }
  const chunkCount = (db.prepare('SELECT COUNT(*) as count FROM external_knowledge_chunks WHERE source_id = ?').get(sourceId) as { count: number }).count;
  return sourceRowToSummary(row, chunkCount, false);
}

export async function safeIngestWebSource(
  input: IngestWebSourceInput,
  options: { db?: Database.Database; fetcher?: typeof fetch } = {},
): Promise<ExternalKnowledgeSourceSummary> {
  try {
    return await ingestWebSource(input, options);
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logError(MODULE, `Web ingest failed: ${normalized.message}`);
    throw normalized;
  }
}

export async function safeIngestYoutubeSource(
  input: IngestYoutubeSourceInput,
  options: { db?: Database.Database } = {},
): Promise<ExternalKnowledgeSourceSummary> {
  try {
    return await ingestYoutubeSource(input, options);
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logError(MODULE, `YouTube ingest failed: ${normalized.message}`);
    throw normalized;
  }
}
