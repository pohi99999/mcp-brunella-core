import { createHash } from 'crypto';

import { ingestSignal } from './intelligenceMonitor.js';
import type {
  IntelligenceBiasLabel,
  IntelligenceDomain,
  IntelligenceSignalRecord,
  IntelligenceStance,
} from './intelligenceMonitor.js';
import { fireHookSafely } from './hookRegistry.js';
import { getGlobalDb } from '../utils/globalDb.js';
import { logInfo } from '../utils/logger.js';

export type WorldPerceptionSourceType = 'manual' | 'knowledge_card';
export type WorldPerceptionSignalStatus = 'detected' | 'promoted' | 'ignored';

export interface WorldPerceptionSignalInput {
  sourceType: WorldPerceptionSourceType;
  source: string;
  title: string;
  summary: string;
  domain: IntelligenceDomain;
  provenance: string;
  biasLabel: IntelligenceBiasLabel;
  sourceRef?: string;
  tags?: string[];
  entity?: string;
  relation?: string;
  stance?: IntelligenceStance;
  confidence?: number;
  observedAt?: string;
}

export interface WorldPerceptionSignalRecord
  extends Omit<WorldPerceptionSignalInput, 'confidence' | 'observedAt' | 'tags'> {
  id: string;
  signalHash: string;
  tags: string[];
  confidence: number;
  freshnessScore: number;
  impactScore: number;
  score: number;
  observedAt: string;
  status: WorldPerceptionSignalStatus;
  intelligenceSignalId: string | null;
  reviewer: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorldPerceptionPromotionResult {
  worldSignal: WorldPerceptionSignalRecord;
  intelligenceSignal: IntelligenceSignalRecord;
}

export interface WorldPerceptionOverview {
  generatedAt: string;
  summary: {
    totalSignals: number;
    detected: number;
    promoted: number;
    ignored: number;
    avgScore: number;
  };
  domainCoverage: Array<{
    domain: IntelligenceDomain;
    count: number;
  }>;
  pendingSignals: WorldPerceptionSignalRecord[];
  freshestSignals: WorldPerceptionSignalRecord[];
  recentPromotions: WorldPerceptionSignalRecord[];
}

export interface WorldPerceptionCycleResult {
  triggeredAt: string;
  scannedCards: number;
  ingestedSignals: number;
  createdSignals: number;
  refreshedSignals: number;
  topSignals: WorldPerceptionSignalRecord[];
}

interface WorldPerceptionSignalRow {
  id: string;
  signal_hash: string;
  source_type: WorldPerceptionSourceType;
  source_ref: string | null;
  source: string;
  title: string;
  summary: string;
  domain: IntelligenceDomain;
  provenance: string;
  bias_label: IntelligenceBiasLabel;
  tags_json: string;
  entity: string | null;
  relation: string | null;
  stance: IntelligenceStance | null;
  confidence: number;
  freshness_score: number;
  impact_score: number;
  score: number;
  observed_at: string;
  status: WorldPerceptionSignalStatus;
  intelligence_signal_id: string | null;
  reviewer: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeCardSeedRow {
  id: string;
  title: string;
  summary: string;
  tags_json: string | null;
  entities_json: string | null;
  evidence_json: string | null;
  source_refs_json: string | null;
  confidence: number;
  status: 'provisional' | 'canonical' | 'deprecated';
  created_at: string;
  updated_at: string;
}

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS world_perception_signals (
    id TEXT PRIMARY KEY,
    signal_hash TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    domain TEXT NOT NULL,
    provenance TEXT NOT NULL,
    bias_label TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    entity TEXT,
    relation TEXT,
    stance TEXT,
    confidence REAL NOT NULL,
    freshness_score REAL NOT NULL,
    impact_score REAL NOT NULL,
    score REAL NOT NULL,
    observed_at TEXT NOT NULL,
    status TEXT NOT NULL,
    intelligence_signal_id TEXT,
    reviewer TEXT,
    review_note TEXT,
    reviewed_at TEXT,
    promoted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

function ensureTable(): void {
  const db = getGlobalDb();
  db.prepare(TABLE_SQL).run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_world_perception_status ON world_perception_signals(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_world_perception_domain ON world_perception_signals(domain)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_world_perception_observed_at ON world_perception_signals(observed_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_world_perception_source_ref ON world_perception_signals(source_ref)').run();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeLower(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
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
  ).slice(0, 24);
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeWhitespace(String(item)))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function hashSignal(input: WorldPerceptionSignalInput): string {
  const payload = [
    input.sourceType,
    normalizeLower(input.sourceRef ?? ''),
    normalizeLower(input.source),
    normalizeLower(input.title),
    normalizeLower(input.summary),
    input.domain,
    normalizeLower(input.entity ?? ''),
    normalizeLower(input.relation ?? ''),
    normalizeLower(input.provenance),
  ].join('|||');

  return createHash('sha256').update(payload).digest('hex');
}

function calculateFreshnessScore(observedAt?: string): number {
  if (!observedAt) {
    return 0.45;
  }

  const timestamp = Date.parse(observedAt);
  if (Number.isNaN(timestamp)) {
    return 0.45;
  }

  const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.85;
  if (ageHours <= 24 * 7) return 0.7;
  if (ageHours <= 24 * 30) return 0.5;
  return 0.3;
}

function calculateImpactScore(input: WorldPerceptionSignalInput): number {
  const confidence = typeof input.confidence === 'number' ? clampScore(input.confidence) : 0.55;
  let score = confidence * 0.7;

  if (normalizeWhitespace(input.provenance).length > 0) score += 0.1;
  if (normalizeWhitespace(input.entity ?? '').length > 0) score += 0.07;
  if (normalizeWhitespace(input.relation ?? '').length > 0) score += 0.04;
  if (sanitizeTags(input.tags).length > 0) score += 0.04;
  if (input.stance && input.stance !== 'neutral') score += 0.05;

  return clampScore(score);
}

function calculateScore(freshnessScore: number, impactScore: number): number {
  return clampScore(freshnessScore * 0.4 + impactScore * 0.6);
}

function mapSignalRow(row: WorldPerceptionSignalRow): WorldPerceptionSignalRecord {
  return {
    id: row.id,
    signalHash: row.signal_hash,
    sourceType: row.source_type,
    sourceRef: row.source_ref ?? undefined,
    source: row.source,
    title: row.title,
    summary: row.summary,
    domain: row.domain,
    provenance: row.provenance,
    biasLabel: row.bias_label,
    tags: parseJsonArray(row.tags_json),
    entity: row.entity ?? undefined,
    relation: row.relation ?? undefined,
    stance: row.stance ?? undefined,
    confidence: Number(row.confidence ?? 0),
    freshnessScore: Number(row.freshness_score ?? 0),
    impactScore: Number(row.impact_score ?? 0),
    score: Number(row.score ?? 0),
    observedAt: row.observed_at,
    status: row.status,
    intelligenceSignalId: row.intelligence_signal_id ?? null,
    reviewer: row.reviewer ?? null,
    reviewNote: row.review_note ?? null,
    reviewedAt: row.reviewed_at ?? null,
    promotedAt: row.promoted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function upsertSignal(
  input: WorldPerceptionSignalInput,
): { record: WorldPerceptionSignalRecord; created: boolean } {
  ensureTable();
  const db = getGlobalDb();
  const signalHash = hashSignal(input);
  const now = nowIso();
  const freshnessScore = calculateFreshnessScore(input.observedAt);
  const impactScore = calculateImpactScore(input);
  const score = calculateScore(freshnessScore, impactScore);
  const existing = db.prepare('SELECT * FROM world_perception_signals WHERE signal_hash = ?').get(signalHash) as WorldPerceptionSignalRow | undefined;
  const signalId = existing?.id ?? `wps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  db.prepare(`
    INSERT INTO world_perception_signals (
      id, signal_hash, source_type, source_ref, source, title, summary, domain, provenance,
      bias_label, tags_json, entity, relation, stance, confidence, freshness_score,
      impact_score, score, observed_at, status, intelligence_signal_id, reviewer,
      review_note, reviewed_at, promoted_at, created_at, updated_at
    ) VALUES (
      @id, @signal_hash, @source_type, @source_ref, @source, @title, @summary, @domain, @provenance,
      @bias_label, @tags_json, @entity, @relation, @stance, @confidence, @freshness_score,
      @impact_score, @score, @observed_at, @status, @intelligence_signal_id, @reviewer,
      @review_note, @reviewed_at, @promoted_at, @created_at, @updated_at
    )
    ON CONFLICT(signal_hash) DO UPDATE SET
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      source = excluded.source,
      title = excluded.title,
      summary = excluded.summary,
      domain = excluded.domain,
      provenance = excluded.provenance,
      bias_label = excluded.bias_label,
      tags_json = excluded.tags_json,
      entity = excluded.entity,
      relation = excluded.relation,
      stance = excluded.stance,
      confidence = excluded.confidence,
      freshness_score = excluded.freshness_score,
      impact_score = excluded.impact_score,
      score = excluded.score,
      observed_at = excluded.observed_at,
      status = CASE
        WHEN world_perception_signals.status = 'promoted' THEN 'promoted'
        WHEN world_perception_signals.status = 'ignored' THEN 'ignored'
        ELSE excluded.status
      END,
      updated_at = excluded.updated_at
  `).run({
    id: signalId,
    signal_hash: signalHash,
    source_type: input.sourceType,
    source_ref: normalizeWhitespace(input.sourceRef ?? '') || null,
    source: normalizeWhitespace(input.source),
    title: normalizeWhitespace(input.title),
    summary: normalizeWhitespace(input.summary),
    domain: input.domain,
    provenance: normalizeWhitespace(input.provenance),
    bias_label: input.biasLabel,
    tags_json: JSON.stringify(sanitizeTags(input.tags)),
    entity: normalizeWhitespace(input.entity ?? '') || null,
    relation: normalizeWhitespace(input.relation ?? '') || null,
    stance: input.stance ?? 'neutral',
    confidence: typeof input.confidence === 'number' ? clampScore(input.confidence) : 0.55,
    freshness_score: freshnessScore,
    impact_score: impactScore,
    score,
    observed_at: input.observedAt ?? now,
    status: existing?.status ?? 'detected',
    intelligence_signal_id: existing?.intelligence_signal_id ?? null,
    reviewer: existing?.reviewer ?? null,
    review_note: existing?.review_note ?? null,
    reviewed_at: existing?.reviewed_at ?? null,
    promoted_at: existing?.promoted_at ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });

  const row = db.prepare('SELECT * FROM world_perception_signals WHERE signal_hash = ?').get(signalHash) as WorldPerceptionSignalRow | undefined;
  if (!row) {
    throw new Error(`Failed to persist world perception signal: ${signalHash}`);
  }

  return {
    record: mapSignalRow(row),
    created: !existing,
  };
}

function hasKnowledgeCardTable(): boolean {
  const db = getGlobalDb();
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'knowledge_cards'
  `).get() as { name?: string } | undefined;
  return row?.name === 'knowledge_cards';
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function classifyDomainFromCard(card: KnowledgeCardSeedRow): IntelligenceDomain {
  const tags = parseJsonArray(card.tags_json);
  const entities = parseJsonArray(card.entities_json);
  const corpus = [
    ...tags,
    ...entities,
    card.title,
    card.summary,
  ].map(normalizeLower).join(' ');

  if (matchesAny(corpus, ['regulation', 'policy', 'government', 'election', 'law', 'legal'])) {
    return 'political';
  }
  if (matchesAny(corpus, ['community', 'society', 'culture', 'hr', 'employee', 'social'])) {
    return 'social';
  }
  if (matchesAny(corpus, ['ai', 'model', 'software', 'code', 'cloud', 'automation', 'technology', 'tech'])) {
    return 'technology';
  }
  if (matchesAny(corpus, ['finance', 'financial', 'revenue', 'cost', 'budget', 'market', 'pricing'])) {
    return 'financial';
  }
  return 'business';
}

function buildCardProvenance(card: KnowledgeCardSeedRow): string {
  const evidence = parseJsonArray(card.evidence_json);
  const sources = parseJsonArray(card.source_refs_json);
  return evidence[0] ?? sources[0] ?? `knowledge-card:${card.id}`;
}

function mapCardToSignalInput(card: KnowledgeCardSeedRow): WorldPerceptionSignalInput {
  const tags = parseJsonArray(card.tags_json);
  const entities = parseJsonArray(card.entities_json);
  return {
    sourceType: 'knowledge_card',
    sourceRef: card.id,
    source: `knowledge-card:${card.id}`,
    title: card.title,
    summary: card.summary,
    domain: classifyDomainFromCard(card),
    provenance: buildCardProvenance(card),
    biasLabel: 'unknown',
    tags,
    entity: entities[0],
    confidence: Number(card.confidence ?? 0.55),
    observedAt: card.updated_at || card.created_at,
  };
}

export function ingestWorldSignal(input: WorldPerceptionSignalInput): WorldPerceptionSignalRecord {
  const { record } = upsertSignal(input);
  return record;
}

export function listWorldSignals(options: {
  limit?: number;
  status?: WorldPerceptionSignalStatus | WorldPerceptionSignalStatus[];
} = {}): WorldPerceptionSignalRecord[] {
  ensureTable();
  const db = getGlobalDb();
  const limit = Math.max(1, Math.trunc(options.limit ?? 25));
  const statuses = Array.isArray(options.status) ? options.status : options.status ? [options.status] : null;
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (statuses && statuses.length > 0) {
    where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    values.push(...statuses);
  }

  const rows = db.prepare(`
    SELECT *
    FROM world_perception_signals
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY observed_at DESC, updated_at DESC
    LIMIT ?
  `).all(...values, limit) as WorldPerceptionSignalRow[];

  return rows.map(mapSignalRow);
}

export function ignoreWorldSignal(
  signalId: string,
  options: { reviewer?: string; note?: string } = {},
): WorldPerceptionSignalRecord {
  ensureTable();
  const db = getGlobalDb();
  const existing = db.prepare('SELECT * FROM world_perception_signals WHERE id = ?').get(signalId) as WorldPerceptionSignalRow | undefined;
  if (!existing) {
    throw new Error(`Unknown world perception signal: ${signalId}`);
  }
  if (existing.status === 'promoted') {
    throw new Error(`Promoted world perception signal cannot be ignored: ${signalId}`);
  }

  const now = nowIso();
  db.prepare(`
    UPDATE world_perception_signals
    SET status = 'ignored',
        reviewer = ?,
        review_note = ?,
        reviewed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    normalizeWhitespace(options.reviewer ?? '') || 'world-perception',
    normalizeWhitespace(options.note ?? '') || null,
    now,
    now,
    signalId,
  );

  const row = db.prepare('SELECT * FROM world_perception_signals WHERE id = ?').get(signalId) as WorldPerceptionSignalRow;
  const record = mapSignalRow(row);
  void fireHookSafely(
    'world.signal.ignored',
    {
      signalId: record.id,
      title: record.title,
      domain: record.domain,
      reviewer: record.reviewer,
    },
    {
      source: 'world-perception',
      metadata: { signalId: record.id, status: record.status },
      logContext: 'WorldPerceptionLayer',
    },
  );
  return record;
}

export async function promoteWorldSignal(
  signalId: string,
  options: { reviewer?: string; note?: string } = {},
): Promise<WorldPerceptionPromotionResult> {
  ensureTable();
  const db = getGlobalDb();
  const row = db.prepare('SELECT * FROM world_perception_signals WHERE id = ?').get(signalId) as WorldPerceptionSignalRow | undefined;
  if (!row) {
    throw new Error(`Unknown world perception signal: ${signalId}`);
  }
  if (row.status === 'promoted' && row.intelligence_signal_id) {
    throw new Error(`World perception signal already promoted: ${signalId}`);
  }

  const signal = mapSignalRow(row);
  const intelligenceSignal = await ingestSignal({
    sourceClass: signal.domain,
    source: signal.source,
    title: signal.title,
    summary: signal.summary,
    entity: signal.entity,
    relation: signal.relation,
    stance: signal.stance,
    biasLabel: signal.biasLabel,
    provenance: signal.provenance,
    confidence: signal.confidence,
  });

  const now = nowIso();
  db.prepare(`
    UPDATE world_perception_signals
    SET status = 'promoted',
        intelligence_signal_id = ?,
        reviewer = ?,
        review_note = ?,
        reviewed_at = ?,
        promoted_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    intelligenceSignal.id,
    normalizeWhitespace(options.reviewer ?? '') || 'world-perception',
    normalizeWhitespace(options.note ?? '') || null,
    now,
    now,
    now,
    signalId,
  );

  const updated = db.prepare('SELECT * FROM world_perception_signals WHERE id = ?').get(signalId) as WorldPerceptionSignalRow;
  const worldSignal = mapSignalRow(updated);
  void fireHookSafely(
    'world.signal.promoted',
    {
      signalId: worldSignal.id,
      title: worldSignal.title,
      domain: worldSignal.domain,
      intelligenceSignalId: intelligenceSignal.id,
    },
    {
      source: 'world-perception',
      metadata: { signalId: worldSignal.id, intelligenceSignalId: intelligenceSignal.id },
      logContext: 'WorldPerceptionLayer',
    },
  );
  logInfo('WorldPerceptionLayer', `Promoted world signal ${signalId} into intelligence signal ${intelligenceSignal.id}`);
  return {
    worldSignal,
    intelligenceSignal,
  };
}

export function runWorldPerceptionCycle(limit = 12): WorldPerceptionCycleResult {
  ensureTable();
  if (!hasKnowledgeCardTable()) {
    return {
      triggeredAt: nowIso(),
      scannedCards: 0,
      ingestedSignals: 0,
      createdSignals: 0,
      refreshedSignals: 0,
      topSignals: [],
    };
  }

  const db = getGlobalDb();
  const normalizedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const cards = db.prepare(`
    SELECT id, title, summary, tags_json, entities_json, evidence_json, source_refs_json,
           confidence, status, created_at, updated_at
    FROM knowledge_cards
    WHERE status IN ('provisional', 'canonical')
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(normalizedLimit) as KnowledgeCardSeedRow[];

  const ingested = cards.map((card) => upsertSignal(mapCardToSignalInput(card)));
  const signals = ingested.map((item) => item.record).sort((left, right) => right.score - left.score);
  const result: WorldPerceptionCycleResult = {
    triggeredAt: nowIso(),
    scannedCards: cards.length,
    ingestedSignals: ingested.length,
    createdSignals: ingested.filter((item) => item.created).length,
    refreshedSignals: ingested.filter((item) => !item.created).length,
    topSignals: signals.slice(0, 5),
  };

  void fireHookSafely(
    'world.cycle.completed',
    {
      scannedCards: result.scannedCards,
      ingestedSignals: result.ingestedSignals,
      createdSignals: result.createdSignals,
      refreshedSignals: result.refreshedSignals,
      topSignalIds: result.topSignals.map((signal) => signal.id),
    },
    {
      source: 'world-perception',
      metadata: { scannedCards: result.scannedCards, ingestedSignals: result.ingestedSignals },
      logContext: 'WorldPerceptionLayer',
    },
  );

  return result;
}

export function getWorldPerceptionOverview(): WorldPerceptionOverview {
  ensureTable();
  const db = getGlobalDb();
  const summaryRow = db.prepare(`
    SELECT
      COUNT(*) AS total_signals,
      SUM(CASE WHEN status = 'detected' THEN 1 ELSE 0 END) AS detected_count,
      SUM(CASE WHEN status = 'promoted' THEN 1 ELSE 0 END) AS promoted_count,
      SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS ignored_count,
      AVG(score) AS avg_score
    FROM world_perception_signals
  `).get() as {
    total_signals?: number;
    detected_count?: number;
    promoted_count?: number;
    ignored_count?: number;
    avg_score?: number;
  };
  const domainCoverage = (db.prepare(`
    SELECT domain, COUNT(*) AS count
    FROM world_perception_signals
    GROUP BY domain
    ORDER BY count DESC
  `).all() as Array<{ domain: IntelligenceDomain; count: number }>)
    .map((entry) => ({
      domain: entry.domain,
      count: Number(entry.count ?? 0),
    }))
    .filter((entry) => entry.count > 0);
  const pendingSignals = listWorldSignals({ limit: 12, status: 'detected' });
  const freshestSignals = (db.prepare(`
    SELECT *
    FROM world_perception_signals
    ORDER BY observed_at DESC, updated_at DESC
    LIMIT 8
  `).all() as WorldPerceptionSignalRow[]).map(mapSignalRow);
  const recentPromotions = (db.prepare(`
    SELECT *
    FROM world_perception_signals
    WHERE status = 'promoted'
    ORDER BY promoted_at DESC, updated_at DESC
    LIMIT 8
  `).all() as WorldPerceptionSignalRow[]).map(mapSignalRow);

  return {
    generatedAt: nowIso(),
    summary: {
      totalSignals: Number(summaryRow.total_signals ?? 0),
      detected: Number(summaryRow.detected_count ?? 0),
      promoted: Number(summaryRow.promoted_count ?? 0),
      ignored: Number(summaryRow.ignored_count ?? 0),
      avgScore: Number(summaryRow.avg_score ?? 0),
    },
    domainCoverage,
    pendingSignals,
    freshestSignals,
    recentPromotions,
  };
}
