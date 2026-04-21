import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const registryHarness = vi.hoisted(() => ({
  db: null as unknown,
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => registryHarness.db,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import {
  attachEvalToModel,
  createTrainingRun,
  getActiveReflexModel,
  listReflexModels,
  promoteReflexModel,
  recordEvalResult,
  registerReflexModelCandidate,
  rollbackReflexModel,
} from '../src/core/reflexModelRegistry.js';

function createPassedCandidate(version: string, categories: string[]) {
  const runId = `train-${version}`;
  createTrainingRun({
    runId,
    snapshotId: `snapshot-${version}`,
    snapshotPath: `snapshots/${version}.jsonl`,
    artifactPath: `artifacts/${version}`,
    status: 'completed',
    dryRun: false,
    modelName: `model-${version}`,
    sampleCount: 12,
    avgQuality: 0.9,
    summary: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  const candidate = registerReflexModelCandidate({
    version,
    displayName: version,
    artifactPath: `artifacts/${version}`,
    snapshotPath: `snapshots/${version}.jsonl`,
    trainerRunId: runId,
    provider: 'ollama',
    modelName: `brunella-reflex:${version}`,
    routineCategories: categories,
  });

  const evalResult = recordEvalResult({
    resultId: `eval-${version}`,
    runId,
    candidateVersion: version,
    baselineModel: 'qwen2.5-coder:7b',
    reportPath: `evals/${version}.json`,
    avgScore: 0.91,
    regressionDelta: 0.08,
    scenarioCount: 6,
    gateStatus: 'passed',
    summary: 'passed',
    createdAt: new Date().toISOString(),
  });

  return attachEvalToModel(candidate.modelId, evalResult.resultId, evalResult.avgScore, evalResult.regressionDelta)!;
}

describe('Reflex model registry', () => {
  let db: Database.Database;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `reflex_registry_${Date.now()}.db`);
    db = new Database(tempDbPath);
    registryHarness.db = db;
  });

  afterEach(async () => {
    db.close();
    registryHarness.db = null;
    try {
      await fs.unlink(tempDbPath);
    } catch {
      // ignore temp cleanup errors
    }
  });

  it('promotes a passed candidate to active and resolves it by routine category', () => {
    const candidate = createPassedCandidate('docs-v1', ['docs', 'test']);

    const promoted = promoteReflexModel(candidate.modelId, 'active', 'tester');

    expect(promoted.state).toBe('active');
    expect(getActiveReflexModel('docs')?.modelId).toBe(candidate.modelId);
  });

  it('rolls back from the active model to a shadow fallback', () => {
    const activeCandidate = createPassedCandidate('active-v1', ['docs']);
    const active = promoteReflexModel(activeCandidate.modelId, 'active', 'tester');

    const shadowCandidate = createPassedCandidate('shadow-v2', ['docs']);
    const shadow = promoteReflexModel(shadowCandidate.modelId, 'shadow', 'tester');

    const rolledBack = rollbackReflexModel(shadow.modelId, 'manual regression rollback');
    const retiredModels = listReflexModels('retired', 10);

    expect(rolledBack.modelId).toBe(shadow.modelId);
    expect(getActiveReflexModel('docs')?.modelId).toBe(shadow.modelId);
    expect(retiredModels.some((model) => model.modelId === active.modelId)).toBe(true);
  });
});
