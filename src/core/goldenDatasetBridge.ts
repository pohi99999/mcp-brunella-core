// FILE: src/core/goldenDatasetBridge.ts
// PURPOSE: G4.1 — Node.js → D1 golden dataset bridge (Phase 3: D1 Integration)
// RULES: RULE-GD1 (success+LLM→save), RULE-GD2 (quality threshold), RULE-GD3 (dedup SHA256)

import { logInfo, logError } from '../utils/logger.js';
import { vectorizeClient } from '../utils/vectorize.js';
import { getD1Adapter, getGlobalDb } from '../utils/globalDb.js';
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

  return {
    success: true,
    message: 'Saved to local golden mirror',
    stats: { storage: 'sqlite', sampleHash },
  };
}

export async function syncLocalToD1(): Promise<{ synced: number; failed: number; skipped: number }> {
  ensureGoldenLocalTable();
  const d1Adapter = getD1Adapter();
  if (!d1Adapter) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const db = getGlobalDb();
  const rows = db.prepare(`
    SELECT *
    FROM golden_samples
    WHERE remote_status != 'synced'
    ORDER BY created_at ASC
  `).all() as Array<Record<string, unknown>>;

  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await d1Adapter.insertGoldenSample({
        id: `golden_${String(row.sample_hash)}`,
        instruction: String(row.prompt),
        output: String(row.completion),
        source: String(row.source),
      });

      if (result.status === 'error') {
        throw new Error(result.error || 'Unknown D1 sync error');
      }

      db.prepare(`
        UPDATE golden_samples
        SET remote_status = 'synced', remote_synced_at = ?, updated_at = ?
        WHERE sample_hash = ?
      `).run(new Date().toISOString(), new Date().toISOString(), String(row.sample_hash));
      synced += 1;
    } catch (error) {
      failed += 1;
      db.prepare(`
        UPDATE golden_samples
        SET remote_status = 'failed', updated_at = ?
        WHERE sample_hash = ?
      `).run(new Date().toISOString(), String(row.sample_hash));
      logError('GoldenBridge', `Local->D1 sync failed for ${String(row.sample_hash)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { synced, failed, skipped: 0 };
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
        ensureGoldenLocalTable();
        getGlobalDb().prepare(`
          UPDATE golden_samples
          SET remote_status = 'synced', remote_synced_at = ?, updated_at = ?
          WHERE sample_hash = ?
        `).run(new Date().toISOString(), new Date().toISOString(), quickHash(`${sample.prompt}|||${sample.completion}`));
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
          quality: sample.quality
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Python API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      ensureGoldenLocalTable();
      getGlobalDb().prepare(`
        UPDATE golden_samples
        SET remote_status = 'synced', remote_synced_at = ?, updated_at = ?
        WHERE sample_hash = ?
      `).run(new Date().toISOString(), new Date().toISOString(), quickHash(`${sample.prompt}|||${sample.completion}`));
      logInfo('GoldenBridge', `Sample saved to Python backup from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
      return { success: true, message: data.message, stats: { ...data.stats, mirror: 'sqlite' } };
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return { success: false, message: `Save failed: ${msg}` };
    }
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
            lastTrainingAt: undefined // TODO: track training runs in D1
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

      const data = await response.json();
      return {
        ...(data.stats as GoldenDatasetStats),
        totalSamples: Math.max(Number(localRow.total_samples ?? 0), Number((data.stats as GoldenDatasetStats).totalSamples ?? 0)),
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
}

function rowToCuratedSample(row: Record<string, unknown>): CuratedGoldenSample {
  return {
    id: String(row['id']),
    prompt: String(row['prompt']),
    completion: String(row['completion']),
    source: String(row['source']),
    quality: Number(row['quality']),
    approvalState: String(row['approval_state']) as CuratedGoldenApprovalState,
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
  limit?: number;
  offset?: number;
}): CuratedGoldenSample[] {
  ensureCuratedTable();
  const db = getGlobalDb();
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  if (opts.state) {
    const rows = db.prepare(
      'SELECT * FROM curated_golden_samples WHERE approval_state = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(opts.state, limit, offset) as Array<Record<string, unknown>>;
    return rows.map(rowToCuratedSample);
  }
  const rows = db.prepare(
    'SELECT * FROM curated_golden_samples ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as Array<Record<string, unknown>>;
  return rows.map(rowToCuratedSample);
}

export function captureCuratedGoldenCandidate(opts: {
  prompt: string;
  completion: string;
  source: string;
  quality?: number;
  provenance?: Record<string, unknown>;
  autoApprove?: boolean;
}): { success: boolean; id?: string; message?: string } {
  ensureCuratedTable();
  const db = getGlobalDb();
  const id = `curated_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const quality = opts.quality ?? calculateQuality(opts.prompt, opts.completion);
  const approvalState: CuratedGoldenApprovalState = opts.autoApprove ? 'approved' : 'pending';
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO curated_golden_samples (id, prompt, completion, source, quality, approval_state, provenance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, opts.prompt, opts.completion, opts.source, quality, approvalState, opts.provenance ? JSON.stringify(opts.provenance) : null, now);
  return { success: true, id };
}

export function captureToolRunCandidates(limit = 50): CuratedGoldenSample[] {
  ensureCuratedTable();
  ensureGoldenLocalTable();
  const db = getGlobalDb();
  const rows = db.prepare(
    'SELECT * FROM golden_samples ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as Array<Record<string, unknown>>;
  const results: CuratedGoldenSample[] = [];
  for (const row of rows) {
    const id = `curated_tool_${String(row['sample_hash'])}`;
    const exists = db.prepare('SELECT id FROM curated_golden_samples WHERE id = ?').get(id);
    if (exists) continue;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT OR IGNORE INTO curated_golden_samples (id, prompt, completion, source, quality, approval_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, String(row['prompt']), String(row['completion']), String(row['source']), Number(row['quality']), 'pending', now);
    results.push({
      id,
      prompt: String(row['prompt']),
      completion: String(row['completion']),
      source: String(row['source']),
      quality: Number(row['quality']),
      approvalState: 'pending',
      createdAt: now,
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

export function getCuratedGoldenStats(): { total: number; pending: number; approved: number; rejected: number } {
  try {
    ensureCuratedTable();
    const db = getGlobalDb();
    const rows = db.prepare(
      'SELECT approval_state, COUNT(*) AS count FROM curated_golden_samples GROUP BY approval_state'
    ).all() as Array<{ approval_state: string; count: number }>;
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) {
      const count = Number(row.count);
      stats.total += count;
      if (row.approval_state === 'pending') stats.pending = count;
      if (row.approval_state === 'approved') stats.approved = count;
      if (row.approval_state === 'rejected') stats.rejected = count;
    }
    return stats;
  } catch {
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
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
