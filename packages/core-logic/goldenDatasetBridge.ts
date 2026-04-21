// FILE: src/core/goldenDatasetBridge.ts
// PURPOSE: G4.1 — Node.js → D1 golden dataset bridge (Phase 3: D1 Integration)
// RULES: RULE-GD1 (success+LLM→save), RULE-GD2 (quality threshold), RULE-GD3 (dedup SHA256)

import { logInfo, logError } from '@packages/utils/logger.js';
import { vectorizeClient } from '@packages/utils/vectorize.js';
import { getD1Adapter, getGlobalDb } from '@packages/utils/globalDb.js';
import { fnvHash } from './hashUtils.js';

// ============================================================================
// TYPES
// ============================================================================

export type CuratedGoldenApprovalState = 'pending' | 'approved' | 'rejected';

export interface CuratedGoldenSample {
  id: string;
  prompt: string;
  completion: string;
  source: string;
  quality: number;
  approvalState: CuratedGoldenApprovalState;
  provenance?: Record<string, unknown>;
  piiRedactedCount?: number;
  createdAt: string;
  approvedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface CuratedGoldenStats {
  totalCandidates: number;
  approvedCount: number;
  rejectedCount: number;
  pendingReview: number;
  avgQuality: number;
  remediationDerived: {
    totalCandidates: number;
    approvedCount: number;
    rejectedCount: number;
    pendingReview: number;
    avgQuality: number;
    lastApprovedAt?: string;
  };
}

export interface GoldenSample {
  prompt: string;
  completion: string;
  source: string;
  quality: number;      // 0.0 - 1.0
}

export interface GoldenSaveResult {
  success: boolean;
  message?: string;
  stats?: Record<string, unknown>;
}

export interface GoldenDatasetStats {
  totalSamples: number;
  newSinceLastTraining: number;
  lastTrainingAt?: string;
  sources?: Record<string, number>;
  avgQuality?: number;
  fileSizeMb?: number;
  status?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://localhost:8000';
const MIN_PROMPT_LENGTH = 10;       // RULE-GD2: minimum task length
const MIN_QUALITY_SCORE = 0.5;      // From goldConfig spec
const SAVE_TIMEOUT_MS = 5000;

// ============================================================================
// DEDUPLICATION (RULE-GD3)
// ============================================================================

const recentHashes = new Set<string>();
const MAX_HASH_CACHE = 500;

/**
 * Simple hash for deduplication — SHA256 not available in all envs,
 * so we use a FNV-1a-like fast hash.
 */
function quickHash(str: string): string {
  return fnvHash(str);
}

function markGoldenSampleRemoteStatus(sampleHash: string, remoteStatus: 'pending' | 'synced' | 'failed'): void {
  ensureGoldenLocalTable();
  const nowIso = new Date().toISOString();

  getGlobalDb().prepare(`
    UPDATE golden_samples
    SET remote_status = ?, remote_synced_at = ?, updated_at = ?
    WHERE sample_hash = ?
  `).run(remoteStatus, remoteStatus === 'synced' ? nowIso : null, nowIso, sampleHash);
}

async function saveGoldenSampleViaPython(sample: GoldenSample): Promise<GoldenSaveResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

  try {
    const response = await fetch(`${PYTHON_BASE_URL}/incubator/gold-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: sample.prompt,
        completion: sample.completion,
        source: sample.source,
        quality: sample.quality,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Python API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { message?: string; stats?: Record<string, unknown> };
    return {
      success: true,
      message: data.message ?? 'Saved to Python backup',
      stats: data.stats,
    };
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    return { success: false, message: `Save failed: ${msg}` };
  }
}

function ensureGoldenLocalTable(): void {
  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS golden_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_hash TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      completion TEXT NOT NULL,
      source TEXT NOT NULL,
      quality REAL NOT NULL,
      remote_status TEXT NOT NULL DEFAULT 'pending',
      remote_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_golden_samples_remote_status ON golden_samples(remote_status);
    CREATE INDEX IF NOT EXISTS idx_golden_samples_created_at ON golden_samples(created_at);
  `);
}

export function saveGoldenSampleLocal(sample: GoldenSample): GoldenSaveResult {
  if (sample.quality < MIN_QUALITY_SCORE) {
    return {
      success: false,
      message: `Quality ${sample.quality} below threshold ${MIN_QUALITY_SCORE} (RULE-GD2)`,
    };
  }

  ensureGoldenLocalTable();
  const db = getGlobalDb();
  const sampleHash = quickHash(`${sample.prompt}|||${sample.completion}`);
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO golden_samples (
      sample_hash, prompt, completion, source, quality, remote_status, created_at, updated_at
    ) VALUES (
      @sample_hash, @prompt, @completion, @source, @quality, 'pending', @created_at, @updated_at
    )
    ON CONFLICT(sample_hash) DO UPDATE SET
      quality = excluded.quality,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run({
    sample_hash: sampleHash,
    prompt: sample.prompt,
    completion: sample.completion,
    source: sample.source,
    quality: sample.quality,
    created_at: nowIso,
    updated_at: nowIso,
  });

  captureCuratedGoldenCandidate({
    id: `curated_tool_${sampleHash}`,
    prompt: sample.prompt,
    completion: sample.completion,
    source: sample.source,
    quality: sample.quality,
    provenance: {
      kind: 'golden_local_mirror',
      sampleHash,
      mirroredAt: nowIso,
    },
  });

  return {
    success: true,
    message: 'Saved to local golden mirror',
    stats: { storage: 'sqlite', sampleHash },
  };
}

export async function syncLocalToD1(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
  mode: 'cloud' | 'local-only';
}> {
  ensureGoldenLocalTable();
  const db = getGlobalDb();
  const rows = db.prepare(`
    SELECT *
    FROM golden_samples
    WHERE remote_status != 'synced'
    ORDER BY created_at ASC
  `).all() as Array<Record<string, unknown>>;
  const d1Adapter = getD1Adapter();
  if (!d1Adapter) {
    return {
      synced: 0,
      failed: 0,
      skipped: rows.length,
      errors: rows.length > 0 ? ['D1 adapter not configured'] : [],
      mode: 'local-only',
    };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const sampleHash = String(row.sample_hash);
    const sample: GoldenSample = {
      prompt: String(row.prompt),
      completion: String(row.completion),
      source: String(row.source),
      quality: Number(row.quality),
    };

    try {
      let syncedRemotely = false;

      if (d1Adapter) {
        const result = await d1Adapter.insertGoldenSample({
          id: `golden_${sampleHash}`,
          instruction: sample.prompt,
          output: sample.completion,
          source: sample.source,
        });

        if (result.status === 'success') {
          syncedRemotely = true;
        } else {
          logError('GoldenBridge', `D1 mirror sync failed for ${sampleHash}: ${result.error ?? 'Unknown D1 sync error'}`);
        }
      }

      if (!syncedRemotely) {
        const pythonResult = await saveGoldenSampleViaPython(sample);
        if (!pythonResult.success) {
          throw new Error(pythonResult.message || 'Unknown Python sync error');
        }
      }

      markGoldenSampleRemoteStatus(sampleHash, 'synced');
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += 1;
      errors.push(message);
      markGoldenSampleRemoteStatus(sampleHash, 'failed');
      logError('GoldenBridge', `Local->remote sync failed for ${sampleHash}: ${message}`);
    }
  }

  return { synced, failed, skipped: 0, errors, mode: 'cloud' };
}

export function exportGoldenDataset(format: 'jsonl' | 'json' = 'jsonl'): string {
  ensureGoldenLocalTable();
  const db = getGlobalDb();
  const rows = db.prepare(`
    SELECT prompt, completion, source, quality, created_at, remote_status
    FROM golden_samples
    ORDER BY created_at DESC
  `).all() as Array<Record<string, unknown>>;

  if (format === 'json') {
    return JSON.stringify(rows, null, 2);
  }

  return rows.map((row) => JSON.stringify(row)).join('\n');
}

function isDuplicate(prompt: string, completion: string): boolean {
  const hash = quickHash(prompt + '|||' + completion);
  if (recentHashes.has(hash)) return true;
  
  recentHashes.add(hash);
  if (recentHashes.size > MAX_HASH_CACHE) {
    // Remove oldest entries (Set iteration order = insertion order)
    const iter = recentHashes.values();
    for (let i = 0; i < 100; i++) iter.next();
    const toKeep = new Set<string>();
    for (const v of recentHashes) {
      if (toKeep.size >= MAX_HASH_CACHE - 100) break;
      toKeep.add(v);
    }
    recentHashes.clear();
    for (const v of toKeep) recentHashes.add(v);
  }
  
  return false;
}

// ============================================================================
// QUALITY SCORING (RULE-GD2)
// ============================================================================

/**
 * Heuristic quality score based on prompt/completion characteristics.
 */
export function calculateQuality(prompt: string, completion: string): number {
  let score = 0.5; // Base

  // Longer prompts tend to be more specific
  if (prompt.length > 50) score += 0.1;
  if (prompt.length > 200) score += 0.1;

  // Longer completions tend to be more complete
  if (completion.length > 100) score += 0.1;
  if (completion.length > 500) score += 0.1;

  // Code-like completions are more valuable
  if (/function|class|export|import|const|let|def |async/.test(completion)) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

// ============================================================================
// CORE BRIDGE
// ============================================================================

/**
 * Save a golden sample to D1 database (Phase 3: Cloud-first storage).
 * Applies RULE-GD1 (success check), RULE-GD2 (quality threshold), RULE-GD3 (dedup).
 */
export async function saveGoldenSample(sample: GoldenSample): Promise<GoldenSaveResult> {
  try {
    // RULE-GD2: quality threshold
    if (sample.prompt.length < MIN_PROMPT_LENGTH) {
      return { success: false, message: 'Prompt too short (RULE-GD2)' };
    }
    if (!sample.completion || sample.completion.trim().length === 0) {
      return { success: false, message: 'Empty completion (RULE-GD2)' };
    }
    if (sample.quality < MIN_QUALITY_SCORE) {
      return { success: false, message: `Quality ${sample.quality} below threshold ${MIN_QUALITY_SCORE} (RULE-GD2)` };
    }

    // RULE-GD3: deduplication
    if (isDuplicate(sample.prompt, sample.completion)) {
      return { success: false, message: 'Duplicate sample (RULE-GD3)' };
    }

    const localResult = saveGoldenSampleLocal(sample);
    if (!localResult.success) {
      return localResult;
    }

    const sampleHash = quickHash(`${sample.prompt}|||${sample.completion}`);

    // Save to D1 (cloud-first strategy)
    const d1Adapter = getD1Adapter();
    if (d1Adapter) {
      try {
        const d1Result = await d1Adapter.insertGoldenSample({
          id: `golden_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          instruction: sample.prompt,
          output: sample.completion,
          source: sample.source,
        });
        
        if (d1Result.status === 'error') {
          throw new Error(d1Result.error || 'Unknown D1 error');
        }
        
        logInfo('GoldenBridge', `Sample saved to D1 from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
        markGoldenSampleRemoteStatus(sampleHash, 'synced');
        return { 
          success: true, 
          message: 'Saved to D1 cloud storage',
          stats: { storage: 'd1', mirror: 'sqlite', quality: sample.quality }
        };
      } catch (d1Error: unknown) {
        const msg = d1Error instanceof Error ? d1Error.message : String(d1Error);
        logError('GoldenBridge', `D1 save failed, falling back to Python: ${msg}`);
        // Fall through to Python backup
        
        // If it's a network error like ECONNREFUSED, we should probably fail fast
        // since the Python backend is likely also unreachable if it's a local network issue
        if (msg.includes('ECONNREFUSED')) {
          return { success: false, message: `Save failed: ${msg}` };
        }
      }
    }

    // Fallback: Python backend (legacy support)
    const pythonResult = await saveGoldenSampleViaPython(sample);
    if (pythonResult.success) {
      markGoldenSampleRemoteStatus(sampleHash, 'synced');
      logInfo('GoldenBridge', `Sample saved to Python backup from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
      return {
        success: true,
        message: pythonResult.message,
        stats: { ...(pythonResult.stats ?? {}), mirror: 'sqlite' },
      };
    }

    markGoldenSampleRemoteStatus(sampleHash, 'failed');
    return pythonResult;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('GoldenBridge', `Save failed: ${msg}`);
    return { success: false, message: msg };
  }
}

/**
 * Get golden dataset statistics from D1 (cloud-first) or Python backup.
 */
export async function getGoldenStats(): Promise<GoldenDatasetStats | null> {
  try {
    ensureGoldenLocalTable();
    const localRow = getGlobalDb().prepare(`
      SELECT COUNT(*) AS total_samples
      FROM golden_samples
    `).get() as Record<string, unknown>;

    // Try D1 first
    const d1Adapter = getD1Adapter();
    if (d1Adapter) {
      try {
        const samplesResult = await d1Adapter.getAllGoldenSamples(1000);
        if (samplesResult.status === 'success' && samplesResult.results) {
          const samples = samplesResult.results;
          return {
            totalSamples: Math.max(samples.length, Number(localRow.total_samples ?? 0)),
            newSinceLastTraining: samples.filter(s => {
              const created = new Date(s.created_at);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return created > weekAgo;
            }).length,
            lastTrainingAt: undefined // TODO [tech-debt-cleanup]: track training runs in D1
          };
        }
      } catch (d1Error: unknown) {
        const msg = d1Error instanceof Error ? d1Error.message : String(d1Error);
        logError('GoldenBridge', `D1 stats failed, trying Python backup: ${msg}`);
      }
    }

    // Fallback: Python backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    try {
      const response = await fetch(`${PYTHON_BASE_URL}/incubator/stats`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json() as { stats?: Record<string, unknown> };
      const pythonStats = data.stats ?? {};
      const pythonTotalSamples = Number(pythonStats.totalSamples ?? pythonStats.total_samples ?? 0);
      const pythonNewSinceLastTraining = Number(pythonStats.newSinceLastTraining ?? pythonStats.new_since_last_training ?? 0);
      const pythonAvgQuality = Number(pythonStats.avgQuality ?? pythonStats.avg_quality ?? 0);
      const pythonFileSizeMb = Number(pythonStats.fileSizeMb ?? pythonStats.file_size_mb ?? 0);
      const normalizedSources = typeof pythonStats.sources === 'object' && pythonStats.sources !== null
        ? Object.fromEntries(
            Object.entries(pythonStats.sources as Record<string, unknown>).map(([key, value]) => [key, Number(value)])
          )
        : undefined;

      return {
        totalSamples: Math.max(Number(localRow.total_samples ?? 0), pythonTotalSamples),
        newSinceLastTraining: Number.isFinite(pythonNewSinceLastTraining) ? pythonNewSinceLastTraining : 0,
        lastTrainingAt: typeof pythonStats.lastTrainingAt === 'string'
          ? pythonStats.lastTrainingAt
          : typeof pythonStats.last_training_at === 'string'
            ? pythonStats.last_training_at
            : undefined,
        sources: normalizedSources,
        avgQuality: Number.isFinite(pythonAvgQuality) ? pythonAvgQuality : undefined,
        fileSizeMb: Number.isFinite(pythonFileSizeMb) ? pythonFileSizeMb : undefined,
        status: typeof pythonStats.status === 'string' ? pythonStats.status : undefined,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return {
        totalSamples: Number(localRow.total_samples ?? 0),
        newSinceLastTraining: 0,
      };
    }
  } catch {
    logError('GoldenBridge', 'Failed to get golden dataset stats from both D1 and Python');
    return null;
  }
}

// ============================================================================
// CURATED GOLDEN DATASET (approval-gated training data)
// ============================================================================

function ensureCuratedTable(): void {
  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS curated_golden_samples (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      completion TEXT NOT NULL,
      source TEXT NOT NULL,
      quality REAL NOT NULL,
      approval_state TEXT NOT NULL DEFAULT 'pending',
      provenance TEXT,
      pii_redacted_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_curated_approval_state ON curated_golden_samples(approval_state);
  `);

  if (!hasLegacyCuratedApprovalState(db)) {
    db.prepare(`
      UPDATE curated_golden_samples
      SET approval_state = 'pending'
      WHERE approval_state = 'candidate'
    `).run();
  }

  ensureGoldenLocalTable();
  const seedApprovalState = getCuratedApprovalStateForDb(db, 'pending');
  db.prepare(`
    INSERT OR IGNORE INTO curated_golden_samples (
      id, prompt, completion, source, quality, approval_state, created_at
    )
    SELECT
      'curated_tool_' || sample_hash,
      prompt,
      completion,
      source,
      quality,
      ?,
      created_at
    FROM golden_samples
  `).run(seedApprovalState);
}

type CuratedGoldenDbApprovalState = CuratedGoldenApprovalState | 'candidate';

const CURATED_GOLDEN_SAMPLE_UPSERT_SQL = `
  INSERT INTO curated_golden_samples (
    id, prompt, completion, source, quality, approval_state, provenance, created_at, approved_at, reviewed_by, review_notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    prompt = excluded.prompt,
    completion = excluded.completion,
    source = excluded.source,
    quality = excluded.quality,
    provenance = COALESCE(excluded.provenance, curated_golden_samples.provenance),
    approval_state = CASE
      WHEN curated_golden_samples.approval_state IN ('approved', 'rejected') THEN curated_golden_samples.approval_state
      ELSE excluded.approval_state
    END,
    approved_at = CASE
      WHEN curated_golden_samples.approval_state = 'approved' THEN curated_golden_samples.approved_at
      ELSE excluded.approved_at
    END,
    reviewed_by = CASE
      WHEN curated_golden_samples.approval_state IN ('approved', 'rejected') THEN curated_golden_samples.reviewed_by
      ELSE excluded.reviewed_by
    END,
    review_notes = CASE
      WHEN curated_golden_samples.approval_state IN ('approved', 'rejected') THEN curated_golden_samples.review_notes
      ELSE excluded.review_notes
    END`;

function getCuratedTableSql(db = getGlobalDb()): string {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get('curated_golden_samples') as { sql?: string } | undefined;
  return typeof row?.sql === 'string' ? row.sql.toLowerCase() : '';
}

function hasLegacyCuratedApprovalState(db = getGlobalDb()): boolean {
  const sql = getCuratedTableSql(db);
  return sql.includes('candidate') && !sql.includes('pending');
}

function normalizeCuratedApprovalState(state: string): CuratedGoldenApprovalState {
  return state === 'candidate' ? 'pending' : (state as CuratedGoldenApprovalState);
}

function getCuratedApprovalStateForDb(
  db: ReturnType<typeof getGlobalDb>,
  approvalState: CuratedGoldenApprovalState,
): CuratedGoldenDbApprovalState {
  return approvalState === 'pending' && hasLegacyCuratedApprovalState(db) ? 'candidate' : approvalState;
}

function getCuratedApprovalStateFilters(
  db: ReturnType<typeof getGlobalDb>,
  state?: CuratedGoldenApprovalState,
): CuratedGoldenDbApprovalState[] {
  if (!state) return [];
  if (state === 'pending' && hasLegacyCuratedApprovalState(db)) {
    return ['pending', 'candidate'];
  }
  return [state];
}

function upsertCuratedGoldenCandidate(
  db: ReturnType<typeof getGlobalDb>,
  args: [
    string,
    string,
    string,
    string,
    number,
    CuratedGoldenDbApprovalState,
    string | null,
    string,
    string | null,
    string | null,
    string | null,
  ],
): void {
  db.prepare(CURATED_GOLDEN_SAMPLE_UPSERT_SQL).run(...args);
}

function rowToCuratedSample(row: Record<string, unknown>): CuratedGoldenSample {
  return {
    id: String(row['id']),
    prompt: String(row['prompt']),
    completion: String(row['completion']),
    source: String(row['source']),
    quality: Number(row['quality']),
    approvalState: normalizeCuratedApprovalState(String(row['approval_state'])),
    provenance: row['provenance'] ? JSON.parse(String(row['provenance'])) as Record<string, unknown> : undefined,
    piiRedactedCount: Number(row['pii_redacted_count'] ?? 0),
    createdAt: String(row['created_at']),
    approvedAt: row['approved_at'] ? String(row['approved_at']) : undefined,
    reviewedBy: row['reviewed_by'] ? String(row['reviewed_by']) : undefined,
    reviewNotes: row['review_notes'] ? String(row['review_notes']) : undefined,
  };
}

export function listCuratedGoldenSamples(opts: {
  state?: CuratedGoldenApprovalState;
  source?: string;
  limit?: number;
  offset?: number;
}): CuratedGoldenSample[] {
  ensureCuratedTable();
  captureToolRunCandidates();
  const db = getGlobalDb();
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  const approvalStates = getCuratedApprovalStateFilters(db, opts.state);
  if (approvalStates.length === 1) {
    conditions.push('approval_state = ?');
    params.push(approvalStates[0]);
  } else if (approvalStates.length > 1) {
    conditions.push(`approval_state IN (${approvalStates.map(() => '?').join(', ')})`);
    params.push(...approvalStates);
  }
  if (opts.source) {
    conditions.push('source = ?');
    params.push(opts.source);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM curated_golden_samples ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as Array<Record<string, unknown>>;
  return rows.map(rowToCuratedSample);
}

export function captureCuratedGoldenCandidate(opts: {
  id?: string;
  prompt: string;
  completion: string;
  source: string;
  quality?: number;
  provenance?: Record<string, unknown>;
  autoApprove?: boolean;
  approvedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}): { success: boolean; id?: string; message?: string } {
  ensureCuratedTable();
  const db = getGlobalDb();
  const id = opts.id ?? `curated_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const quality = opts.quality ?? calculateQuality(opts.prompt, opts.completion);
  const approvalState: CuratedGoldenApprovalState = opts.autoApprove ? 'approved' : 'pending';
  const approvalStateForDb = getCuratedApprovalStateForDb(db, approvalState);
  const now = new Date().toISOString();
  const existing = db.prepare(
    'SELECT approval_state AS approvalState, approved_at AS approvedAt, reviewed_by AS reviewedBy, review_notes AS reviewNotes FROM curated_golden_samples WHERE id = ?'
  ).get(id) as {
    approvalState?: string;
    approvedAt?: string | null;
    reviewedBy?: string | null;
    reviewNotes?: string | null;
  } | undefined;
  upsertCuratedGoldenCandidate(
    db,
    [
      id,
      opts.prompt,
      opts.completion,
      opts.source,
      quality,
      approvalStateForDb,
      opts.provenance ? JSON.stringify(opts.provenance) : null,
      now,
      approvalStateForDb === 'approved' ? (opts.approvedAt ?? now) : existing?.approvedAt ?? null,
      opts.reviewedBy ?? existing?.reviewedBy ?? null,
      opts.reviewNotes ?? existing?.reviewNotes ?? null,
    ],
  );
  return { success: true, id };
}

export function getCuratedGoldenSample(sampleId: string): CuratedGoldenSample | null {
  ensureCuratedTable();
  const row = getGlobalDb()
    .prepare('SELECT * FROM curated_golden_samples WHERE id = ?')
    .get(sampleId) as Record<string, unknown> | undefined;
  return row ? rowToCuratedSample(row) : null;
}

export function captureToolRunCandidates(limit = 50): CuratedGoldenSample[] {
  ensureCuratedTable();
  const db = getGlobalDb();
  const hasToolRunsTable = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get('tool_runs')
  );
  if (!hasToolRunsTable) {
    return [];
  }
  const rows = db.prepare(
    'SELECT * FROM tool_runs WHERE success = 1 ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Array<Record<string, unknown>>;
  const results: CuratedGoldenSample[] = [];
  for (const row of rows) {
    const id = `curated_tool_run_${String(row['id'])}`;
    const exists = db.prepare('SELECT id FROM curated_golden_samples WHERE id = ?').get(id);
    if (exists) continue;
    const prompt = `Tool execution request\nTool: ${String(row['tool_name'])}\nInput:\n${String(row['input_params'] ?? '(empty)')}`.slice(0, 4000);
    const completion = `Tool execution response\nTool: ${String(row['tool_name'])}\nOutput:\n${String(row['output_data'] ?? '(empty)')}`.slice(0, 8000);
    const createdAt = String(row['timestamp'] ?? new Date().toISOString());
    const quality = Math.max(
      Number(row['quality_score'] ?? 0),
      calculateQuality(prompt, completion),
    );
    captureCuratedGoldenCandidate({
      id,
      prompt,
      completion,
      source: `tool_run:${String(row['tool_name'])}`,
      quality,
      provenance: {
        kind: 'tool_run_capture',
        toolRunId: row['id'],
        toolName: row['tool_name'],
        timestamp: row['timestamp'],
      },
    });
    results.push({
      id,
      prompt,
      completion,
      source: `tool_run:${String(row['tool_name'])}`,
      quality,
      approvalState: 'pending',
      createdAt,
    });
  }
  return results;
}

export function reviewCuratedGoldenSample(
  sampleId: string,
  decision: 'approved' | 'rejected',
  reviewer: string,
  notes?: string,
): CuratedGoldenSample | null {
  ensureCuratedTable();
  const db = getGlobalDb();
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE curated_golden_samples SET approval_state = ?, reviewed_by = ?, review_notes = ?, approved_at = ? WHERE id = ?'
  ).run(decision, reviewer, notes ?? null, decision === 'approved' ? now : null, sampleId);
  if ((result as { changes: number }).changes === 0) return null;
  const row = db.prepare('SELECT * FROM curated_golden_samples WHERE id = ?').get(sampleId) as Record<string, unknown> | undefined;
  return row ? rowToCuratedSample(row) : null;
}

export function getCuratedGoldenStats(): CuratedGoldenStats {
  try {
    ensureCuratedTable();
    captureToolRunCandidates(200);
    const db = getGlobalDb();
    const rows = db.prepare(
      'SELECT approval_state, COUNT(*) AS count, AVG(quality) AS avg_quality FROM curated_golden_samples GROUP BY approval_state'
    ).all() as Array<{ approval_state: string; count: number; avg_quality: number | null }>;
    const remediationRows = db.prepare(
      `SELECT approval_state, COUNT(*) AS count, AVG(quality) AS avg_quality, MAX(approved_at) AS last_approved_at
       FROM curated_golden_samples
       WHERE source = ?
       GROUP BY approval_state`
    ).all('github_remediation_runtime') as Array<{
      approval_state: string;
      count: number;
      avg_quality: number | null;
      last_approved_at: string | null;
    }>;

    const stats: CuratedGoldenStats = {
      totalCandidates: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingReview: 0,
      avgQuality: 0,
      remediationDerived: {
        totalCandidates: 0,
        approvedCount: 0,
        rejectedCount: 0,
        pendingReview: 0,
        avgQuality: 0,
      },
    };

    let weightedQuality = 0;
    for (const row of rows) {
      const count = Number(row.count);
      stats.totalCandidates += count;
      weightedQuality += (Number(row.avg_quality ?? 0) * count);
      const approvalState = normalizeCuratedApprovalState(row.approval_state);
      if (approvalState === 'pending') stats.pendingReview = count;
      if (approvalState === 'approved') stats.approvedCount = count;
      if (approvalState === 'rejected') stats.rejectedCount = count;
    }
    if (stats.totalCandidates > 0) {
      stats.avgQuality = Math.round((weightedQuality / stats.totalCandidates) * 100) / 100;
    }

    let remediationWeightedQuality = 0;
    let latestApprovedAt: string | undefined;
    for (const row of remediationRows) {
      const count = Number(row.count);
      stats.remediationDerived.totalCandidates += count;
      remediationWeightedQuality += (Number(row.avg_quality ?? 0) * count);
      const approvalState = normalizeCuratedApprovalState(row.approval_state);
      if (approvalState === 'pending') stats.remediationDerived.pendingReview = count;
      if (approvalState === 'approved') {
        stats.remediationDerived.approvedCount = count;
        latestApprovedAt = row.last_approved_at ?? latestApprovedAt;
      }
      if (approvalState === 'rejected') stats.remediationDerived.rejectedCount = count;
    }
    if (stats.remediationDerived.totalCandidates > 0) {
      stats.remediationDerived.avgQuality =
        Math.round((remediationWeightedQuality / stats.remediationDerived.totalCandidates) * 100) / 100;
    }
    stats.remediationDerived.lastApprovedAt = latestApprovedAt;

    return stats;
  } catch {
    return {
      totalCandidates: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingReview: 0,
      avgQuality: 0,
      remediationDerived: {
        totalCandidates: 0,
        approvedCount: 0,
        rejectedCount: 0,
        pendingReview: 0,
        avgQuality: 0,
      },
    };
  }
}

export function captureApprovedRemediationGoldenCandidate(run: {
  id: string;
  repositoryName: string;
  status: string;
  updatedAt: string;
  sourceEventType?: string;
  analysis?: { summary?: string; affectedFiles?: string[] };
  fixer?: { agentName?: string; resultSummary?: string };
  verification?: Array<{ name: string; status: string }>;
  finalApproval?: { response?: unknown };
}): { success: boolean; id?: string; duplicate?: boolean; message?: string } {
  ensureCuratedTable();
  const existing = listCuratedGoldenSamples({
    source: 'github_remediation_runtime',
    state: 'approved',
    limit: 5000,
  }).find((sample) => {
    const provenance = sample.provenance ?? {};
    return provenance.kind === 'approved_remediation' && provenance.remediationRunId === run.id;
  });

  if (existing) {
    return { success: true, id: existing.id, duplicate: true };
  }

  const affectedFiles = Array.isArray(run.analysis?.affectedFiles) ? run.analysis?.affectedFiles.join(', ') : '';
  const verificationSummary = Array.isArray(run.verification)
    ? run.verification.map((step) => `${step.name}:${step.status}`).join(', ')
    : 'none';
  const completion = [
    `Selected fixer: ${run.fixer?.agentName ?? 'unknown'}`,
    run.fixer?.resultSummary,
    run.analysis?.summary,
    affectedFiles ? `Affected files: ${affectedFiles}` : '',
    `Verification: ${verificationSummary}`,
    'Final operator approval granted',
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('\n');

  const prompt = [
    'GitHub workflow failure remediation task.',
    `Repository: ${run.repositoryName}`,
    `Run: ${run.id}`,
  ].join(' ');

  const saved = captureCuratedGoldenCandidate({
    id: `curated_remediation_${run.id}`,
    prompt,
    completion,
    source: 'github_remediation_runtime',
    quality: 0.95,
    autoApprove: true,
    approvedAt: run.updatedAt,
    reviewedBy:
      typeof run.finalApproval?.response === 'object' &&
      run.finalApproval?.response !== null &&
      'by' in run.finalApproval.response &&
      typeof (run.finalApproval.response as { by?: unknown }).by === 'string'
        ? (run.finalApproval.response as { by: string }).by
        : undefined,
    reviewNotes: 'Auto-approved remediation capture',
    provenance: {
      kind: 'approved_remediation',
      remediationRunId: run.id,
      repositoryName: run.repositoryName,
      sourceEventType: run.sourceEventType,
      finalApprovalResponse: run.finalApproval?.response,
    },
  });

  return {
    success: saved.success,
    id: saved.id,
    duplicate: false,
    message: saved.message,
  };
}

export function exportCuratedGoldenDataset(format: 'jsonl' | 'json' = 'jsonl'): string {
  return exportGoldenDataset(format);
}

/**
 * Auto-save hook for AgentManager — called after successful agent execution.
 * Implements RULE-GD1: success + LLM call → save.
 */
export async function autoSaveGoldenSample(
  agentName: string,
  task: string,
  result: string | Record<string, unknown> | object
): Promise<void> {
  const completion = typeof result === 'string' ? result : JSON.stringify(result);
  const quality = calculateQuality(task, completion);

  if (quality < MIN_QUALITY_SCORE) {
    return; // Skip low-quality samples silently
  }

  // Fire-and-forget (non-blocking, RULE: audit write async)
  saveGoldenSample({
    prompt: task,
    completion,
    source: agentName,
    quality
  }).catch(() => { /* non-critical */ });

  // Vectorize upsert
  if (process.env.CF_VECTORIZE_ENABLED === 'true' || vectorizeClient.getStatus().enabled) {
    vectorizeClient.upsertText(
      `golden-${Date.now()}`,
      `${task}\n${completion}`,
      { source: agentName, type: 'golden_sample', quality }
    ).catch(e => logError('GoldenBridge', `Vectorize upsert failed: ${e.message}`));
  }
}

