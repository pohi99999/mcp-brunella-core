import { getGlobalDb } from '../utils/globalDb.js';
import { logInfo, logWarn } from '../utils/logger.js';

export type ReflexModelState = 'candidate' | 'shadow' | 'active' | 'retired';
export type TrainingRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dry_run';
export type EvalGateStatus = 'passed' | 'failed' | 'warning';

export interface TrainingRunRecord {
  runId: string;
  snapshotId: string;
  snapshotPath: string;
  artifactPath?: string;
  status: TrainingRunStatus;
  dryRun: boolean;
  modelName: string;
  sampleCount: number;
  avgQuality: number;
  summary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

export interface EvalResultRecord {
  resultId: string;
  runId: string;
  candidateVersion: string;
  baselineModel: string;
  reportPath: string;
  markdownReportPath?: string;
  avgScore: number;
  regressionDelta: number;
  scenarioCount: number;
  gateStatus: EvalGateStatus;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ReflexModelRecord {
  modelId: string;
  version: string;
  displayName: string;
  state: ReflexModelState;
  provider: string;
  modelName: string;
  artifactPath: string;
  snapshotPath: string;
  trainerRunId: string;
  evalResultId?: string;
  avgScore?: number;
  regressionDelta?: number;
  routineCategories: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  promotedAt?: string;
  promotedBy?: string;
  retiredAt?: string;
  retiredReason?: string;
}

export interface RegisterReflexCandidateInput {
  version: string;
  displayName: string;
  artifactPath: string;
  snapshotPath: string;
  trainerRunId: string;
  provider?: string;
  modelName?: string;
  routineCategories?: string[];
  metadata?: Record<string, unknown>;
}

export interface ReflexRegistrySummary {
  activeModel: ReflexModelRecord | null;
  shadowModels: ReflexModelRecord[];
  candidateModels: ReflexModelRecord[];
  retiredModels: ReflexModelRecord[];
  latestTrainingRuns: TrainingRunRecord[];
  latestEvalResults: EvalResultRecord[];
}

const DEFAULT_ROUTINE_CATEGORIES = ['code_gen', 'docs', 'test', 'debug'];

function nowIso(): string {
  return new Date().toISOString();
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeCategories(categories?: string[]): string[] {
  const base = categories && categories.length > 0 ? categories : DEFAULT_ROUTINE_CATEGORIES;
  return Array.from(new Set(base.map((item) => item.trim()).filter(Boolean)));
}

function ensureLearningLoopTables(): void {
  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_training_runs (
      run_id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      snapshot_path TEXT NOT NULL,
      artifact_path TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'dry_run')),
      dry_run INTEGER NOT NULL DEFAULT 0,
      model_name TEXT NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      avg_quality REAL NOT NULL DEFAULT 0,
      summary TEXT,
      error TEXT,
      metadata TEXT DEFAULT '{}',
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_eval_results (
      result_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      candidate_version TEXT NOT NULL,
      baseline_model TEXT NOT NULL,
      report_path TEXT NOT NULL,
      markdown_report_path TEXT,
      avg_score REAL NOT NULL DEFAULT 0,
      regression_delta REAL NOT NULL DEFAULT 0,
      scenario_count INTEGER NOT NULL DEFAULT 0,
      gate_status TEXT NOT NULL CHECK(gate_status IN ('passed', 'failed', 'warning')),
      summary TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES learning_training_runs(run_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reflex_models (
      model_id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('candidate', 'shadow', 'active', 'retired')),
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      snapshot_path TEXT NOT NULL,
      trainer_run_id TEXT NOT NULL,
      eval_result_id TEXT,
      avg_score REAL,
      regression_delta REAL,
      routine_categories TEXT NOT NULL DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      promoted_at TEXT,
      promoted_by TEXT,
      retired_at TEXT,
      retired_reason TEXT,
      FOREIGN KEY(trainer_run_id) REFERENCES learning_training_runs(run_id) ON DELETE CASCADE,
      FOREIGN KEY(eval_result_id) REFERENCES learning_eval_results(result_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_learning_training_runs_status ON learning_training_runs(status);
    CREATE INDEX IF NOT EXISTS idx_learning_eval_results_gate_status ON learning_eval_results(gate_status);
    CREATE INDEX IF NOT EXISTS idx_reflex_models_state ON reflex_models(state);
  `);
}

function mapTrainingRunRow(row: Record<string, unknown>): TrainingRunRecord {
  return {
    runId: String(row.run_id),
    snapshotId: String(row.snapshot_id),
    snapshotPath: String(row.snapshot_path),
    artifactPath: row.artifact_path ? String(row.artifact_path) : undefined,
    status: String(row.status) as TrainingRunStatus,
    dryRun: Number(row.dry_run ?? 0) === 1,
    modelName: String(row.model_name),
    sampleCount: Number(row.sample_count ?? 0),
    avgQuality: Number(row.avg_quality ?? 0),
    summary: row.summary ? String(row.summary) : undefined,
    error: row.error ? String(row.error) : undefined,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata as string | null | undefined, {}),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

function mapEvalRow(row: Record<string, unknown>): EvalResultRecord {
  return {
    resultId: String(row.result_id),
    runId: String(row.run_id),
    candidateVersion: String(row.candidate_version),
    baselineModel: String(row.baseline_model),
    reportPath: String(row.report_path),
    markdownReportPath: row.markdown_report_path ? String(row.markdown_report_path) : undefined,
    avgScore: Number(row.avg_score ?? 0),
    regressionDelta: Number(row.regression_delta ?? 0),
    scenarioCount: Number(row.scenario_count ?? 0),
    gateStatus: String(row.gate_status) as EvalGateStatus,
    summary: row.summary ? String(row.summary) : undefined,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata as string | null | undefined, {}),
    createdAt: String(row.created_at),
  };
}

function mapModelRow(row: Record<string, unknown>): ReflexModelRecord {
  return {
    modelId: String(row.model_id),
    version: String(row.version),
    displayName: String(row.display_name),
    state: String(row.state) as ReflexModelState,
    provider: String(row.provider),
    modelName: String(row.model_name),
    artifactPath: String(row.artifact_path),
    snapshotPath: String(row.snapshot_path),
    trainerRunId: String(row.trainer_run_id),
    evalResultId: row.eval_result_id ? String(row.eval_result_id) : undefined,
    avgScore: row.avg_score !== null && row.avg_score !== undefined ? Number(row.avg_score) : undefined,
    regressionDelta: row.regression_delta !== null && row.regression_delta !== undefined ? Number(row.regression_delta) : undefined,
    routineCategories: safeJsonParse<string[]>(row.routine_categories as string | null | undefined, DEFAULT_ROUTINE_CATEGORIES),
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata as string | null | undefined, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    promotedAt: row.promoted_at ? String(row.promoted_at) : undefined,
    promotedBy: row.promoted_by ? String(row.promoted_by) : undefined,
    retiredAt: row.retired_at ? String(row.retired_at) : undefined,
    retiredReason: row.retired_reason ? String(row.retired_reason) : undefined,
  };
}

export function getDefaultRoutineCategories(): string[] {
  return [...DEFAULT_ROUTINE_CATEGORIES];
}

export function createTrainingRun(record: TrainingRunRecord): TrainingRunRecord {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  db.prepare(`
    INSERT INTO learning_training_runs (
      run_id, snapshot_id, snapshot_path, artifact_path, status, dry_run, model_name,
      sample_count, avg_quality, summary, error, metadata, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.runId,
    record.snapshotId,
    record.snapshotPath,
    record.artifactPath ?? null,
    record.status,
    record.dryRun ? 1 : 0,
    record.modelName,
    record.sampleCount,
    record.avgQuality,
    record.summary ?? null,
    record.error ?? null,
    JSON.stringify(record.metadata ?? {}),
    record.startedAt,
    record.completedAt ?? null,
  );
  return record;
}

export function updateTrainingRun(runId: string, patch: Partial<TrainingRunRecord>): TrainingRunRecord | null {
  ensureLearningLoopTables();
  const existing = getTrainingRun(runId);
  if (!existing) return null;
  const next: TrainingRunRecord = {
    ...existing,
    ...patch,
    metadata: { ...(existing.metadata ?? {}), ...(patch.metadata ?? {}) },
  };
  const db = getGlobalDb();
  db.prepare(`
    UPDATE learning_training_runs
    SET snapshot_id = ?, snapshot_path = ?, artifact_path = ?, status = ?, dry_run = ?, model_name = ?,
        sample_count = ?, avg_quality = ?, summary = ?, error = ?, metadata = ?, started_at = ?, completed_at = ?
    WHERE run_id = ?
  `).run(
    next.snapshotId,
    next.snapshotPath,
    next.artifactPath ?? null,
    next.status,
    next.dryRun ? 1 : 0,
    next.modelName,
    next.sampleCount,
    next.avgQuality,
    next.summary ?? null,
    next.error ?? null,
    JSON.stringify(next.metadata ?? {}),
    next.startedAt,
    next.completedAt ?? null,
    runId,
  );
  return next;
}

export function getTrainingRun(runId: string): TrainingRunRecord | null {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const row = db.prepare('SELECT * FROM learning_training_runs WHERE run_id = ?').get(runId) as Record<string, unknown> | undefined;
  return row ? mapTrainingRunRow(row) : null;
}

export function listTrainingRuns(limit = 10): TrainingRunRecord[] {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const rows = db.prepare('SELECT * FROM learning_training_runs ORDER BY started_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapTrainingRunRow);
}

export function recordEvalResult(record: EvalResultRecord): EvalResultRecord {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  db.prepare(`
    INSERT INTO learning_eval_results (
      result_id, run_id, candidate_version, baseline_model, report_path, markdown_report_path,
      avg_score, regression_delta, scenario_count, gate_status, summary, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.resultId,
    record.runId,
    record.candidateVersion,
    record.baselineModel,
    record.reportPath,
    record.markdownReportPath ?? null,
    record.avgScore,
    record.regressionDelta,
    record.scenarioCount,
    record.gateStatus,
    record.summary ?? null,
    JSON.stringify(record.metadata ?? {}),
    record.createdAt,
  );
  return record;
}

export function getEvalResult(resultId: string): EvalResultRecord | null {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const row = db.prepare('SELECT * FROM learning_eval_results WHERE result_id = ?').get(resultId) as Record<string, unknown> | undefined;
  return row ? mapEvalRow(row) : null;
}

export function listEvalResults(limit = 10): EvalResultRecord[] {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const rows = db.prepare('SELECT * FROM learning_eval_results ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapEvalRow);
}

export function registerReflexModelCandidate(input: RegisterReflexCandidateInput): ReflexModelRecord {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const timestamp = nowIso();
  const existing = db.prepare('SELECT * FROM reflex_models WHERE version = ?').get(input.version) as Record<string, unknown> | undefined;
  const modelId = existing ? String(existing.model_id) : `reflex_${Date.now()}`;
  const provider = input.provider ?? 'ollama';
  const modelName = input.modelName ?? input.version;
  const categories = normalizeCategories(input.routineCategories);

  db.prepare(`
    INSERT INTO reflex_models (
      model_id, version, display_name, state, provider, model_name, artifact_path, snapshot_path,
      trainer_run_id, routine_categories, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, 'candidate', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(version) DO UPDATE SET
      display_name = excluded.display_name,
      artifact_path = excluded.artifact_path,
      snapshot_path = excluded.snapshot_path,
      trainer_run_id = excluded.trainer_run_id,
      routine_categories = excluded.routine_categories,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `).run(
    modelId,
    input.version,
    input.displayName,
    provider,
    modelName,
    input.artifactPath,
    input.snapshotPath,
    input.trainerRunId,
    JSON.stringify(categories),
    JSON.stringify(input.metadata ?? {}),
    timestamp,
    timestamp,
  );

  const created = getReflexModel(modelId);
  if (!created) {
    throw new Error(`Failed to register reflex model candidate: ${input.version}`);
  }
  logInfo('ReflexRegistry', `Candidate registered: ${created.version}`);
  return created;
}

export function attachEvalToModel(modelId: string, evalResultId: string, avgScore: number, regressionDelta: number): ReflexModelRecord | null {
  ensureLearningLoopTables();
  const current = getReflexModel(modelId);
  if (!current) return null;
  const db = getGlobalDb();
  db.prepare(`
    UPDATE reflex_models
    SET eval_result_id = ?, avg_score = ?, regression_delta = ?, updated_at = ?
    WHERE model_id = ?
  `).run(evalResultId, avgScore, regressionDelta, nowIso(), modelId);
  return getReflexModel(modelId);
}

export function getReflexModel(modelId: string): ReflexModelRecord | null {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const row = db.prepare('SELECT * FROM reflex_models WHERE model_id = ?').get(modelId) as Record<string, unknown> | undefined;
  return row ? mapModelRow(row) : null;
}

export function listReflexModels(state?: ReflexModelState, limit = 25): ReflexModelRecord[] {
  ensureLearningLoopTables();
  const db = getGlobalDb();
  const rows = state
    ? db.prepare('SELECT * FROM reflex_models WHERE state = ? ORDER BY updated_at DESC LIMIT ?').all(state, limit)
    : db.prepare('SELECT * FROM reflex_models ORDER BY updated_at DESC LIMIT ?').all(limit);
  return (rows as Array<Record<string, unknown>>).map(mapModelRow);
}

export function getActiveReflexModel(taskCategory?: string): ReflexModelRecord | null {
  ensureLearningLoopTables();
  const activeModels = listReflexModels('active', 5);
  if (!taskCategory) {
    return activeModels[0] ?? null;
  }
  return activeModels.find((model) => model.routineCategories.includes(taskCategory)) ?? activeModels[0] ?? null;
}

export function promoteReflexModel(
  modelId: string,
  targetState: Extract<ReflexModelState, 'shadow' | 'active'> = 'active',
  promotedBy = 'system',
  note?: string,
): ReflexModelRecord {
  ensureLearningLoopTables();
  const candidate = getReflexModel(modelId);
  if (!candidate) {
    throw new Error(`Reflex model not found: ${modelId}`);
  }

  if (targetState === 'active') {
    if (!candidate.evalResultId) {
      throw new Error('Only evaluated candidates can become active');
    }
    const evalResult = getEvalResult(candidate.evalResultId);
    if (!evalResult || evalResult.gateStatus !== 'passed') {
      throw new Error('Only passed eval results can be promoted to active');
    }
  }

  const db = getGlobalDb();
  const timestamp = nowIso();
  const currentActive = getActiveReflexModel();
  if (currentActive && currentActive.modelId !== modelId && targetState === 'active') {
    db.prepare(`
      UPDATE reflex_models
      SET state = 'shadow', updated_at = ?, retired_reason = ?
      WHERE model_id = ?
    `).run(timestamp, `Demoted during promotion of ${candidate.version}`, currentActive.modelId);
  }

  db.prepare(`
    UPDATE reflex_models
    SET state = ?, promoted_at = ?, promoted_by = ?, updated_at = ?, retired_reason = NULL, retired_at = NULL
    WHERE model_id = ?
  `).run(targetState, timestamp, promotedBy, timestamp, modelId);

  const promoted = getReflexModel(modelId);
  if (!promoted) {
    throw new Error(`Failed to promote reflex model: ${modelId}`);
  }
  logInfo('ReflexRegistry', `Model ${promoted.version} promoted to ${targetState}${note ? ` (${note})` : ''}`);
  return promoted;
}

export function retireReflexModel(modelId: string, reason = 'manual'): ReflexModelRecord | null {
  ensureLearningLoopTables();
  const current = getReflexModel(modelId);
  if (!current) return null;
  const db = getGlobalDb();
  const timestamp = nowIso();
  db.prepare(`
    UPDATE reflex_models
    SET state = 'retired', retired_at = ?, retired_reason = ?, updated_at = ?
    WHERE model_id = ?
  `).run(timestamp, reason, timestamp, modelId);
  return getReflexModel(modelId);
}

export function rollbackReflexModel(targetModelId?: string, reason = 'manual rollback'): ReflexModelRecord {
  ensureLearningLoopTables();
  const active = getActiveReflexModel();
  const fallback = targetModelId
    ? getReflexModel(targetModelId)
    : listReflexModels('shadow', 10).find((model) => Boolean(model.evalResultId));

  if (!fallback) {
    throw new Error('No rollback target available');
  }

  const db = getGlobalDb();
  const timestamp = nowIso();
  if (active) {
    db.prepare(`
      UPDATE reflex_models
      SET state = 'retired', retired_at = ?, retired_reason = ?, updated_at = ?
      WHERE model_id = ?
    `).run(timestamp, reason, timestamp, active.modelId);
  }

  db.prepare(`
    UPDATE reflex_models
    SET state = 'active', promoted_at = ?, promoted_by = ?, updated_at = ?, retired_reason = NULL, retired_at = NULL
    WHERE model_id = ?
  `).run(timestamp, 'rollback', timestamp, fallback.modelId);

  const promoted = getReflexModel(fallback.modelId);
  if (!promoted) {
    throw new Error('Rollback target disappeared during activation');
  }
  logWarn('ReflexRegistry', `Rollback activated ${promoted.version} (${reason})`);
  return promoted;
}

export function getReflexRegistrySummary(): ReflexRegistrySummary {
  ensureLearningLoopTables();
  return {
    activeModel: getActiveReflexModel(),
    shadowModels: listReflexModels('shadow', 10),
    candidateModels: listReflexModels('candidate', 10),
    retiredModels: listReflexModels('retired', 10),
    latestTrainingRuns: listTrainingRuns(10),
    latestEvalResults: listEvalResults(10),
  };
}
