import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  attachEvalToModel,
  createTrainingRun,
  type EvalResultRecord,
  getActiveReflexModel,
  getDefaultRoutineCategories,
  getReflexModel,
  getReflexRegistrySummary,
  listTrainingRuns,
  type ReflexModelRecord,
  recordEvalResult,
  registerReflexModelCandidate,
  promoteReflexModel,
  rollbackReflexModel,
  type TrainingRunRecord,
  updateTrainingRun,
} from './reflexModelRegistry.js';
import {
  exportCuratedGoldenDataset,
  getCuratedGoldenStats,
  listCuratedGoldenSamples,
  type CuratedGoldenSample,
} from './goldenDatasetBridge.js';
import { logError, logInfo } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const SNAPSHOT_ROOT = path.join(process.cwd(), 'data', 'learning-loop', 'snapshots');
const ARTIFACT_ROOT = path.join(process.cwd(), 'data', 'learning-loop', 'artifacts');
const EVAL_ROOT = path.join(process.cwd(), 'data', 'learning-loop', 'evals');

export interface CuratedSnapshotResult {
  snapshotId: string;
  snapshotPath: string;
  metadataPath: string;
  sampleCount: number;
  avgQuality: number;
  sourceFilter?: string;
  minQuality: number;
  createdAt: string;
}

export interface LearningLoopTrainingRunMetadata extends Record<string, unknown> {
  snapshotSource?: string;
  minQuality?: number;
  routineCategories?: string[];
}

export interface TrainingExecutionResult {
  trainingRun: TrainingRunRecord;
  modelCandidate: ReflexModelRecord;
  snapshot: CuratedSnapshotResult;
}

export interface EvalExecutionResult {
  evalResult: EvalResultRecord;
  modelCandidate: ReflexModelRecord;
}

export interface LearningLoopCycleResult {
  snapshot: CuratedSnapshotResult;
  training: TrainingExecutionResult;
  evaluation: EvalExecutionResult;
  promotedModel?: ReflexModelRecord;
}

function timestampId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

async function ensureLearningLoopDirs(): Promise<void> {
  await fs.mkdir(SNAPSHOT_ROOT, { recursive: true });
  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
  await fs.mkdir(EVAL_ROOT, { recursive: true });
}

function buildChatMlEntry(sample: CuratedGoldenSample): Record<string, unknown> {
  const provenance = sample.provenance ?? {};
  const systemPrompt = typeof provenance.systemPrompt === 'string'
    ? provenance.systemPrompt
    : 'You are Brunella Reflex, a task-specialized local helper model.';

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sample.prompt },
      { role: 'assistant', content: sample.completion },
    ],
    metadata: {
      candidateId: sample.id,
      source: sample.source,
      quality: sample.quality,
      approvalState: sample.approvalState,
      piiRedactedCount: sample.piiRedactedCount,
      createdAt: sample.createdAt,
      approvedAt: sample.approvedAt,
      provenance: sample.provenance,
    },
  };
}

async function runPythonJson(scriptRelativePath: string, args: string[]): Promise<Record<string, unknown>> {
  const scriptPath = path.join(process.cwd(), scriptRelativePath);
  const launchers: Array<{ command: string; baseArgs: string[] }> = [
    { command: 'uv', baseArgs: ['run', 'python'] },
    { command: 'python', baseArgs: [] },
    { command: 'py', baseArgs: ['-3'] },
  ];

  let lastError: Error | null = null;
  for (const launcher of launchers) {
    try {
      const { stdout } = await execFileAsync(launcher.command, [...launcher.baseArgs, scriptPath, ...args], {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 4,
      });
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const lastLine = lines.at(-1);
      if (!lastLine) {
        throw new Error(`No JSON output from ${scriptRelativePath}`);
      }
      return JSON.parse(lastLine) as Record<string, unknown>;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Unable to execute ${scriptRelativePath}`);
}

export async function createCuratedSnapshot(
  options?: number | { minQuality?: number; source?: string },
): Promise<CuratedSnapshotResult> {
  await ensureLearningLoopDirs();
  const minQuality = typeof options === 'number' ? options : (options?.minQuality ?? 0.7);
  const sourceFilter = typeof options === 'object' ? options.source : undefined;
  const approved = listCuratedGoldenSamples({ state: 'approved', source: sourceFilter, limit: 5000 })
    .filter((sample) => sample.quality >= minQuality);

  if (approved.length === 0) {
    throw new Error('No approved curated samples available for snapshot generation');
  }

  const snapshotId = sourceFilter === 'github_remediation_runtime'
    ? timestampId('snapshot_remediation')
    : sourceFilter
      ? timestampId(`snapshot_${sourceFilter.replace(/[^a-z0-9]+/gi, '_')}`)
      : timestampId('snapshot');
  const snapshotPath = path.join(SNAPSHOT_ROOT, `${snapshotId}.jsonl`);
  const metadataPath = path.join(SNAPSHOT_ROOT, `${snapshotId}.meta.json`);
  const lines = approved.map((sample) => JSON.stringify(buildChatMlEntry(sample)));
  const avgQuality = approved.reduce((sum, sample) => sum + sample.quality, 0) / approved.length;
  const createdAt = new Date().toISOString();

  await fs.writeFile(snapshotPath, lines.join('\n') + '\n', 'utf-8');
  await fs.writeFile(metadataPath, JSON.stringify({
    snapshotId,
    snapshotPath,
    sampleCount: approved.length,
    avgQuality,
    createdAt,
    source: 'approved_curated_dataset',
    sourceFilter,
    minQuality,
  }, null, 2), 'utf-8');

  logInfo('LearningLoop', `Curated snapshot created: ${snapshotId} (${approved.length} samples)`);
  return {
    snapshotId,
    snapshotPath,
    metadataPath,
    sampleCount: approved.length,
    avgQuality,
    sourceFilter,
    minQuality,
    createdAt,
  };
}

export async function runNightlyTraining(options?: {
  dryRun?: boolean;
  snapshot?: CuratedSnapshotResult;
  modelName?: string;
  routineCategories?: string[];
}): Promise<TrainingExecutionResult> {
  const dryRun = options?.dryRun ?? true;
  const snapshot = options?.snapshot ?? await createCuratedSnapshot();
  await ensureLearningLoopDirs();

  const runId = timestampId('train');
  const trainingRun: TrainingRunRecord = createTrainingRun({
    runId,
    snapshotId: snapshot.snapshotId,
    snapshotPath: snapshot.snapshotPath,
    artifactPath: undefined,
    status: 'running',
    dryRun,
    modelName: options?.modelName ?? 'brunella-reflex',
    sampleCount: snapshot.sampleCount,
    avgQuality: snapshot.avgQuality,
    metadata: {
      routineCategories: options?.routineCategories ?? getDefaultRoutineCategories(),
      snapshotSource: snapshot.sourceFilter,
      minQuality: snapshot.minQuality,
    } satisfies LearningLoopTrainingRunMetadata,
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await runPythonJson('myai/training/nightly_trainer.py', [
      '--snapshot', snapshot.snapshotPath,
      '--artifact-root', ARTIFACT_ROOT,
      '--run-id', runId,
      '--model-name', trainingRun.modelName,
      ...(dryRun ? ['--dry-run'] : []),
    ]);

    const version = typeof result.version === 'string' ? result.version : `${trainingRun.modelName}-${runId}`;
    const artifactPath = typeof result.artifact_path === 'string'
      ? result.artifact_path
      : path.join(ARTIFACT_ROOT, version);

    const updatedRun = updateTrainingRun(runId, {
      artifactPath,
      status: dryRun ? 'dry_run' : 'completed',
      summary: typeof result.summary === 'string' ? result.summary : 'Training completed',
      completedAt: new Date().toISOString(),
      metadata: asRecord(result),
    });

    if (!updatedRun) {
      throw new Error(`Training run disappeared during update: ${runId}`);
    }

    const modelCandidate = registerReflexModelCandidate({
      version,
      displayName: typeof result.display_name === 'string' ? result.display_name : `Brunella Reflex ${version}`,
      artifactPath,
      snapshotPath: snapshot.snapshotPath,
      trainerRunId: runId,
      provider: typeof result.provider === 'string' ? result.provider : 'ollama',
      modelName: typeof result.model_name === 'string' ? result.model_name : version,
      routineCategories: options?.routineCategories ?? getDefaultRoutineCategories(),
      metadata: {
        ...asRecord(result),
        snapshotId: snapshot.snapshotId,
        dryRun,
      },
    });

    return { snapshot, trainingRun: updatedRun, modelCandidate };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTrainingRun(runId, {
      status: 'failed',
      error: message,
      summary: 'Nightly trainer failed',
      completedAt: new Date().toISOString(),
    });
    logError('LearningLoop', `Nightly trainer failed: ${message}`);
    throw error;
  }
}

export async function runEvalHarness(options?: {
  modelId?: string;
  baselineModel?: string;
}): Promise<EvalExecutionResult> {
  await ensureLearningLoopDirs();
  const candidate = options?.modelId ? getReflexModel(options.modelId) : getReflexRegistrySummary().candidateModels[0];
  if (!candidate) {
    throw new Error('No reflex model candidate available for evaluation');
  }

  const result = await runPythonJson('myai/training/eval_harness.py', [
    '--artifact', candidate.artifactPath,
    '--version', candidate.version,
    '--eval-root', EVAL_ROOT,
    '--baseline-model', options?.baselineModel ?? 'qwen2.5-coder:7b',
    '--run-id', candidate.trainerRunId,
  ]);

  const evalRecord = recordEvalResult({
    resultId: typeof result.result_id === 'string' ? result.result_id : timestampId('eval'),
    runId: candidate.trainerRunId,
    candidateVersion: candidate.version,
    baselineModel: typeof result.baseline_model === 'string' ? result.baseline_model : (options?.baselineModel ?? 'qwen2.5-coder:7b'),
    reportPath: typeof result.report_path === 'string' ? result.report_path : path.join(EVAL_ROOT, `${candidate.version}.json`),
    markdownReportPath: typeof result.markdown_report_path === 'string' ? result.markdown_report_path : undefined,
    avgScore: Number(result.avg_score ?? 0),
    regressionDelta: Number(result.regression_delta ?? 0),
    scenarioCount: Number(result.scenario_count ?? 0),
    gateStatus: (typeof result.gate_status === 'string' ? result.gate_status : 'failed') as EvalResultRecord['gateStatus'],
    summary: typeof result.summary === 'string' ? result.summary : 'Eval completed',
    metadata: asRecord(result),
    createdAt: new Date().toISOString(),
  });

  const updatedCandidate = attachEvalToModel(candidate.modelId, evalRecord.resultId, evalRecord.avgScore, evalRecord.regressionDelta);
  if (!updatedCandidate) {
    throw new Error(`Unable to attach eval result to candidate ${candidate.modelId}`);
  }

  return { evalResult: evalRecord, modelCandidate: updatedCandidate };
}

export async function executeLearningLoopCycle(options?: {
  dryRun?: boolean;
  promotePassed?: boolean;
  baselineModel?: string;
}): Promise<LearningLoopCycleResult> {
  const training = await runNightlyTraining({ dryRun: options?.dryRun ?? true });
  const evaluation = await runEvalHarness({ modelId: training.modelCandidate.modelId, baselineModel: options?.baselineModel });

  let promotedModel: ReflexModelRecord | undefined;
  if (options?.promotePassed && evaluation.evalResult.gateStatus === 'passed') {
    promotedModel = promoteReflexModel(training.modelCandidate.modelId, training.trainingRun.dryRun ? 'shadow' : 'active', 'learning-loop-cycle');
  }

  return {
    snapshot: training.snapshot,
    training,
    evaluation,
    promotedModel,
  };
}

export async function getLearningLoopOverview(): Promise<Record<string, unknown>> {
  const curatedStats = await getCuratedGoldenStats();
  const latestSnapshot = (await listLearningLoopSnapshots())[0] ?? null;
  return {
    curatedStats,
    registry: getReflexRegistrySummary(),
    latestTrainingRuns: listTrainingRuns(10),
    latestSnapshot,
    activeReflexModel: getActiveReflexModel(),
    approvedDatasetPreview: exportCuratedGoldenDataset('json'),
  };
}

export async function listLearningLoopSnapshots(limit = 20): Promise<CuratedSnapshotResult[]> {
  await ensureLearningLoopDirs();
  const entries = await fs.readdir(SNAPSHOT_ROOT, { withFileTypes: true });
  const metadataFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.meta.json'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const snapshots: CuratedSnapshotResult[] = [];
  for (const fileName of metadataFiles.slice(0, limit)) {
    try {
      const metadataPath = path.join(SNAPSHOT_ROOT, fileName);
      const raw = await fs.readFile(metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CuratedSnapshotResult> & { createdAt?: string };
      if (
        typeof parsed.snapshotId !== 'string' ||
        typeof parsed.snapshotPath !== 'string' ||
        typeof parsed.sampleCount !== 'number' ||
        typeof parsed.avgQuality !== 'number'
      ) {
        continue;
      }
      snapshots.push({
        snapshotId: parsed.snapshotId,
        snapshotPath: parsed.snapshotPath,
        metadataPath,
        sampleCount: parsed.sampleCount,
        avgQuality: parsed.avgQuality,
        sourceFilter: typeof parsed.sourceFilter === 'string' ? parsed.sourceFilter : undefined,
        minQuality: typeof parsed.minQuality === 'number' ? parsed.minQuality : 0.7,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      });
    } catch (error) {
      logError('LearningLoop', `Failed to parse snapshot metadata ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function promoteLearningLoopModel(modelId: string): ReflexModelRecord {
  return promoteReflexModel(modelId, 'active', 'manual');
}

export function rollbackLearningLoopModel(targetModelId?: string, reason?: string): ReflexModelRecord {
  return rollbackReflexModel(targetModelId, reason ?? 'manual rollback');
}
