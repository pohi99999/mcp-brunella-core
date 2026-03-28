import { createHash } from 'crypto';
import { getGlobalDb, getToolRunStats } from '../utils/globalDb.js';
import { logError, logInfo } from '../utils/logger.js';
import { exportGoldenDataset, getGoldenStats, saveGoldenSample } from './goldenDatasetBridge.js';
import { getIndexStatus, reindexChangedFiles } from './codebaseIndexer.js';
import { getMemoryStats } from './structuredMemory.js';

export type IntelligenceDomain = 'business' | 'social' | 'political' | 'financial' | 'technology';
export type IntelligenceStance = 'supports' | 'contradicts' | 'neutral';
export type IntelligenceBiasLabel = 'low' | 'medium' | 'high' | 'unknown';
export type IntelligenceSignalStatus = 'pending_review' | 'approved' | 'rejected' | 'promoted';

export interface IntelligenceSourceClass {
  id: IntelligenceDomain;
  label: string;
  description: string;
  provenanceRequired: boolean;
  biasLabelRequired: boolean;
  sensitiveReviewRequired: boolean;
}

export interface IntelligenceSignalInput {
  sourceClass: IntelligenceDomain;
  source: string;
  title: string;
  summary: string;
  entity?: string;
  relation?: string;
  stance?: IntelligenceStance;
  biasLabel: IntelligenceBiasLabel;
  provenance: string;
  confidence?: number;
}

export interface IntelligenceSignalRecord extends Omit<IntelligenceSignalInput, 'confidence'> {
  confidence: number;
  id: string;
  signalHash: string;
  score: number;
  status: IntelligenceSignalStatus;
  contradictionNote: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceOverview {
  generatedAt: string;
  governance: {
    sourceClasses: IntelligenceSourceClass[];
    guardrails: string[];
    reviewPolicy: string[];
  };
  stats: {
    golden: Awaited<ReturnType<typeof getGoldenStats>>;
    memory: ReturnType<typeof getMemoryStats>;
    index: ReturnType<typeof getIndexStatus>;
    tools: ReturnType<typeof getToolRunStats>;
  };
  signals: {
    total: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    promoted: number;
  };
  reviewQueue: IntelligenceSignalRecord[];
  recentPromotions: Array<{
    source: string;
    prompt: string;
    quality: number;
    createdAt: string;
    remoteStatus: string;
  }>;
  feedback: {
    avgScore: number;
    contradictionCount: number;
    recentEvidenceCount: number;
  };
}

const SOURCE_CLASSES: IntelligenceSourceClass[] = [
  {
    id: 'business',
    label: 'Business',
    description: 'Public vállalati, piaci és iparági jelzések.',
    provenanceRequired: true,
    biasLabelRequired: true,
    sensitiveReviewRequired: false,
  },
  {
    id: 'social',
    label: 'Society',
    description: 'Közéleti, társadalmi és közösségi trendek.',
    provenanceRequired: true,
    biasLabelRequired: true,
    sensitiveReviewRequired: true,
  },
  {
    id: 'political',
    label: 'Political',
    description: 'Public policy, választási és intézményi jelzések.',
    provenanceRequired: true,
    biasLabelRequired: true,
    sensitiveReviewRequired: true,
  },
  {
    id: 'financial',
    label: 'Financial',
    description: 'Mikro- és makrogazdasági, pénzügyi és piaci jelzések.',
    provenanceRequired: true,
    biasLabelRequired: true,
    sensitiveReviewRequired: false,
  },
  {
    id: 'technology',
    label: 'Technology',
    description: 'Technológiai trendek, termékek és kutatási jelzések.',
    provenanceRequired: true,
    biasLabelRequired: true,
    sensitiveReviewRequired: false,
  },
];

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS intelligence_signals (
    id TEXT PRIMARY KEY,
    signal_hash TEXT NOT NULL UNIQUE,
    source_class TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    entity TEXT,
    relation TEXT,
    stance TEXT,
    bias_label TEXT NOT NULL,
    provenance TEXT NOT NULL,
    confidence REAL NOT NULL,
    score REAL NOT NULL,
    status TEXT NOT NULL,
    contradiction_note TEXT,
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
  db.prepare('CREATE INDEX IF NOT EXISTS idx_intelligence_status ON intelligence_signals(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_intelligence_source_class ON intelligence_signals(source_class)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_intelligence_entity ON intelligence_signals(entity)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_intelligence_created_at ON intelligence_signals(created_at)').run();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function hashSignal(input: IntelligenceSignalInput): string {
  const payload = [
    input.sourceClass,
    normalizeText(input.source),
    normalizeText(input.title),
    normalizeText(input.summary),
    normalizeText(input.entity ?? ''),
    normalizeText(input.relation ?? ''),
    input.stance ?? 'neutral',
    input.biasLabel,
    normalizeText(input.provenance),
  ].join('|||');

  return createHash('sha256').update(payload).digest('hex');
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getGovernanceFramework(): {
  sourceClasses: IntelligenceSourceClass[];
  guardrails: string[];
  reviewPolicy: string[];
} {
  return {
    sourceClasses: SOURCE_CLASSES,
    guardrails: [
      'Nincs személyes profilozás.',
      'Csak public, licencelt vagy engedélyezett források használhatók.',
      'Provenance és bias label kötelező minden nem-triviális jelzésnél.',
      'Érzékeny domain-eknél human review szükséges.',
      'Minden promotion auditálható és visszakereshető.',
    ],
    reviewPolicy: [
      '0.80 feletti score esetén is maradjon pending, amíg review nem történik.',
      'Politikai és társadalmi jelzések mindig manuális review-t kapnak.',
      'Kontradikció esetén a jelzés review queue-ba kerül.',
      'Promóció után golden dataset write path és index refresh fut.',
    ],
  };
}

export function scoreSignal(input: IntelligenceSignalInput): number {
  const confidence = typeof input.confidence === 'number' ? input.confidence : 0.5;
  let score = confidence;

  if (input.provenance.trim().length > 0) {
    score += 0.08;
  }
  if (input.title.trim().length > 24) {
    score += 0.05;
  }
  if (input.summary.trim().length > 80) {
    score += 0.05;
  }
  if (input.entity?.trim()) {
    score += 0.05;
  }
  if (input.relation?.trim()) {
    score += 0.03;
  }
  if (input.biasLabel !== 'unknown') {
    score += 0.04;
  }
  if (input.sourceClass === 'political' || input.sourceClass === 'social') {
    score -= 0.03;
  }

  return clampScore(score);
}

function mapSignalRow(row: Record<string, unknown>): IntelligenceSignalRecord {
  return {
    id: String(row.id),
    signalHash: String(row.signal_hash),
    sourceClass: row.source_class as IntelligenceDomain,
    source: String(row.source),
    title: String(row.title),
    summary: String(row.summary),
    entity: row.entity ? String(row.entity) : undefined,
    relation: row.relation ? String(row.relation) : undefined,
    stance: (row.stance ? String(row.stance) : 'neutral') as IntelligenceStance,
    biasLabel: row.bias_label as IntelligenceBiasLabel,
    provenance: String(row.provenance),
    confidence: Number(row.confidence ?? 0),
    score: Number(row.score ?? 0),
    status: row.status as IntelligenceSignalStatus,
    contradictionNote: row.contradiction_note ? String(row.contradiction_note) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    promotedAt: row.promoted_at ? String(row.promoted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function detectContradiction(input: IntelligenceSignalInput): string | null {
  if (!input.entity?.trim() || !input.stance || input.stance === 'neutral') {
    return null;
  }

  const db = getGlobalDb();
  const rows = db.prepare(`
    SELECT title, source, stance
    FROM intelligence_signals
    WHERE entity = ? AND status IN ('approved', 'promoted')
  `).all(input.entity.trim().toLowerCase()) as Array<Record<string, unknown>>;

  const opposite = rows.find((row) => {
    const stance = String(row.stance ?? 'neutral') as IntelligenceStance;
    return (input.stance === 'supports' && stance === 'contradicts')
      || (input.stance === 'contradicts' && stance === 'supports');
  });

  if (!opposite) {
    return null;
  }

  return `Kontradikció észlelve a(z) ${String(opposite.title ?? 'ismeretlen')} jelzéssel (${String(opposite.source ?? 'ismeretlen forrás')}).`;
}

export function listSignals(options: { limit?: number; status?: IntelligenceSignalStatus | IntelligenceSignalStatus[] } = {}): IntelligenceSignalRecord[] {
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

  const sql = `
    SELECT *
    FROM intelligence_signals
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const rows = db.prepare(sql).all(...values, limit) as Array<Record<string, unknown>>;
  return rows.map(mapSignalRow);
}

export function listReviewQueue(limit = 10): IntelligenceSignalRecord[] {
  ensureTable();
  const rows = listSignals({ limit: Math.max(10, limit * 3) });
  return rows
    .filter((signal) => signal.status === 'pending_review' || signal.contradictionNote !== null || signal.score < 0.75)
    .slice(0, limit);
}

export async function ingestSignal(input: IntelligenceSignalInput): Promise<IntelligenceSignalRecord> {
  ensureTable();
  const db = getGlobalDb();
  const now = new Date().toISOString();
  const signalHash = hashSignal(input);
  const score = scoreSignal(input);
  const contradictionNote = detectContradiction(input);

  const existing = db.prepare('SELECT * FROM intelligence_signals WHERE signal_hash = ?').get(signalHash) as Record<string, unknown> | undefined;
  const status: IntelligenceSignalStatus = existing ? String(existing.status) as IntelligenceSignalStatus : 'pending_review';
  const recordId = existing ? String(existing.id) : `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  db.prepare(`
    INSERT INTO intelligence_signals (
      id, signal_hash, source_class, source, title, summary, entity, relation, stance,
      bias_label, provenance, confidence, score, status, contradiction_note,
      review_note, reviewed_at, promoted_at, created_at, updated_at
    ) VALUES (
      @id, @signal_hash, @source_class, @source, @title, @summary, @entity, @relation, @stance,
      @bias_label, @provenance, @confidence, @score, @status, @contradiction_note,
      @review_note, @reviewed_at, @promoted_at, @created_at, @updated_at
    )
    ON CONFLICT(signal_hash) DO UPDATE SET
      source_class = excluded.source_class,
      source = excluded.source,
      title = excluded.title,
      summary = excluded.summary,
      entity = excluded.entity,
      relation = excluded.relation,
      stance = excluded.stance,
      bias_label = excluded.bias_label,
      provenance = excluded.provenance,
      confidence = excluded.confidence,
      score = excluded.score,
      status = CASE
        WHEN intelligence_signals.status = 'promoted' THEN 'promoted'
        WHEN intelligence_signals.status = 'approved' AND excluded.status = 'pending_review' THEN 'approved'
        ELSE excluded.status
      END,
      contradiction_note = excluded.contradiction_note,
      updated_at = excluded.updated_at
  `).run({
    id: recordId,
    signal_hash: signalHash,
    source_class: input.sourceClass,
    source: input.source.trim(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    entity: input.entity?.trim() || null,
    relation: input.relation?.trim() || null,
    stance: input.stance ?? 'neutral',
    bias_label: input.biasLabel,
    provenance: input.provenance.trim(),
    confidence: typeof input.confidence === 'number' ? input.confidence : 0.5,
    score,
    status,
    contradiction_note: contradictionNote,
    review_note: existing?.review_note ?? null,
    reviewed_at: existing?.reviewed_at ?? null,
    promoted_at: existing?.promoted_at ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });

  const row = db.prepare('SELECT * FROM intelligence_signals WHERE signal_hash = ?').get(signalHash) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Nem sikerült visszaolvasni a jelzést: ${signalHash}`);
  }

  return mapSignalRow(row);
}

export async function reviewSignal(signalId: string, decision: 'approve' | 'reject', note?: string): Promise<IntelligenceSignalRecord> {
  ensureTable();
  const db = getGlobalDb();
  const row = db.prepare('SELECT * FROM intelligence_signals WHERE id = ?').get(signalId) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Ismeretlen intelligence jelzés: ${signalId}`);
  }

  const now = new Date().toISOString();
  const signal = mapSignalRow(row);

  if (decision === 'reject') {
    db.prepare(`
      UPDATE intelligence_signals
      SET status = 'rejected', review_note = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(note ?? null, now, now, signalId);
    const rejectedRow = db.prepare('SELECT * FROM intelligence_signals WHERE id = ?').get(signalId) as Record<string, unknown>;
    return mapSignalRow(rejectedRow);
  }

  const prompt = `${signal.title}\n\n${signal.summary}\n\nEntity: ${signal.entity ?? 'n/a'}\nRelation: ${signal.relation ?? 'n/a'}\nSource: ${signal.source}`;
  const completion = [
    `Source class: ${signal.sourceClass}`,
    `Bias label: ${signal.biasLabel}`,
    `Provenance: ${signal.provenance}`,
    `Stance: ${signal.stance}`,
    `Confidence: ${(signal.confidence ?? 0).toFixed(2)}`,
    note ? `Review note: ${note}` : null,
  ].filter((part): part is string => Boolean(part)).join('\n');

  const saveResult = await saveGoldenSample({
    source: `intelligence:${signal.sourceClass}`,
    prompt,
    completion,
    quality: clampScore(signal.score),
  });

  if (!saveResult.success) {
    throw new Error(`Golden dataset promotion failed: ${saveResult.message}`);
  }

  try {
    await reindexChangedFiles();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('IntelligenceMonitor', `Reindex after promotion failed: ${message}`);
  }

  db.prepare(`
    UPDATE intelligence_signals
    SET status = 'promoted', review_note = ?, reviewed_at = ?, promoted_at = ?, updated_at = ?
    WHERE id = ?
  `).run(note ?? null, now, now, now, signalId);

  const promotedRow = db.prepare('SELECT * FROM intelligence_signals WHERE id = ?').get(signalId) as Record<string, unknown>;
  logInfo('IntelligenceMonitor', `Signal promoted: ${signal.title}`);
  return mapSignalRow(promotedRow);
}

function readRecentPromotions(limit = 8): Array<{ source: string; prompt: string; quality: number; createdAt: string; remoteStatus: string; }> {
  const raw = exportGoldenDataset('json');
  let rows: unknown[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      rows = parsed;
    }
  } catch {
    rows = [];
  }

  return rows.slice(0, limit).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      source: String(record.source ?? 'unknown'),
      prompt: String(record.prompt ?? ''),
      quality: Number(record.quality ?? 0),
      createdAt: String(record.created_at ?? ''),
      remoteStatus: String(record.remote_status ?? 'local'),
    };
  });
}

export async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
  ensureTable();
  const governance = getGovernanceFramework();
  const signals = listSignals({ limit: 200 });
  const reviewQueue = listReviewQueue(12);
  const memory = getMemoryStats();
  const index = getIndexStatus();
  const golden = await getGoldenStats();
  const tools = getToolRunStats();
  const recentPromotions = readRecentPromotions(8);
  const lowConfidenceCount = signals.filter((signal) => signal.score < 0.75).length;
  const contradictionCount = signals.filter((signal) => Boolean(signal.contradictionNote)).length;

  return {
    generatedAt: new Date().toISOString(),
    governance,
    stats: {
      golden,
      memory,
      index,
      tools,
    },
    signals: {
      total: signals.length,
      pendingReview: signals.filter((signal) => signal.status === 'pending_review').length,
      approved: signals.filter((signal) => signal.status === 'approved').length,
      rejected: signals.filter((signal) => signal.status === 'rejected').length,
      promoted: signals.filter((signal) => signal.status === 'promoted').length,
    },
    reviewQueue,
    recentPromotions,
    feedback: {
      avgScore: signals.length > 0 ? signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length : 0,
      contradictionCount,
      recentEvidenceCount: Math.max(0, reviewQueue.length + lowConfidenceCount),
    },
  };
}
