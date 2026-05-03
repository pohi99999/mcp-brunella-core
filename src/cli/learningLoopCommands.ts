import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import inquirer from 'inquirer';
import { logError } from '../utils/logger.js';
import { writeLine } from '../utils/cliOutput.js';

type EvalGateStatus = 'passed' | 'failed' | 'warning';
type ReflexModelState = 'candidate' | 'shadow' | 'active' | 'retired';
type TrainingRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dry_run';

interface CuratedGoldenStats {
  totalCandidates: number;
  approvedCount: number;
  rejectedCount: number;
  pendingReview: number;
  avgQuality: number;
  lastApprovedAt?: string;
}

interface TrainingRunRecord {
  runId: string;
  status: TrainingRunStatus;
  dryRun: boolean;
  modelName: string;
  sampleCount: number;
  avgQuality: number;
  summary?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface EvalResultRecord {
  resultId: string;
  candidateVersion: string;
  baselineModel: string;
  avgScore: number;
  regressionDelta: number;
  scenarioCount: number;
  gateStatus: EvalGateStatus;
  summary?: string;
  createdAt: string;
}

interface ReflexModelRecord {
  modelId: string;
  version: string;
  displayName: string;
  state: ReflexModelState;
  provider: string;
  modelName: string;
  evalResultId?: string;
  avgScore?: number;
  regressionDelta?: number;
  routineCategories: string[];
  promotedAt?: string;
}

interface ReflexRegistrySummary {
  activeModel: ReflexModelRecord | null;
  shadowModels: ReflexModelRecord[];
  candidateModels: ReflexModelRecord[];
  retiredModels: ReflexModelRecord[];
  latestTrainingRuns: TrainingRunRecord[];
  latestEvalResults: EvalResultRecord[];
}

interface LearningLoopOverview {
  curatedStats: CuratedGoldenStats | null;
  registry: ReflexRegistrySummary;
  latestTrainingRuns: TrainingRunRecord[];
  activeReflexModel: ReflexModelRecord | null;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/learning-loop${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload.data;
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function printOverview(data: LearningLoopOverview): void {
  const registry = data.registry;
  const activeModel = registry.activeModel ?? data.activeReflexModel;
  const latestTraining = registry.latestTrainingRuns[0] ?? data.latestTrainingRuns[0];
  const latestEval = registry.latestEvalResults[0];

  writeLine(boxen(chalk.cyan('🧠 Learning Loop állapot'), { padding: 1, borderStyle: 'round' }));
  writeLine(chalk.bold('\nKurált dataset'));
  writeLine(`  Approved: ${chalk.green(String(data.curatedStats?.approvedCount ?? 0))}`);
  writeLine(`  Pending:  ${chalk.yellow(String(data.curatedStats?.pendingReview ?? 0))}`);
  writeLine(`  Rejected: ${chalk.red(String(data.curatedStats?.rejectedCount ?? 0))}`);
  writeLine(`  Quality:  ${chalk.white((data.curatedStats?.avgQuality ?? 0).toFixed(2))}`);

  writeLine(chalk.bold('\nReflex registry'));
  writeLine(`  Aktív modell: ${activeModel ? chalk.green(activeModel.version) : chalk.gray('nincs')}`);
  writeLine(`  Candidate:    ${chalk.yellow(String(registry.candidateModels.length))}`);
  writeLine(`  Shadow:       ${chalk.cyan(String(registry.shadowModels.length))}`);
  writeLine(`  Retired:      ${chalk.gray(String(registry.retiredModels.length))}`);

  writeLine(chalk.bold('\nLegutóbbi futások'));
  if (latestTraining) {
    writeLine(`  Training: ${chalk.white(latestTraining.runId)} (${latestTraining.status})`);
    writeLine(`            ${latestTraining.sampleCount} minta • quality ${latestTraining.avgQuality.toFixed(2)} • ${formatTimestamp(latestTraining.completedAt ?? latestTraining.startedAt)}`);
  } else {
    writeLine(`  Training: ${chalk.gray('nincs')}`);
  }

  if (latestEval) {
    writeLine(`  Eval:     ${chalk.white(latestEval.candidateVersion)} (${latestEval.gateStatus})`);
    writeLine(`            score ${latestEval.avgScore.toFixed(2)} • Δ ${latestEval.regressionDelta.toFixed(3)} • ${formatTimestamp(latestEval.createdAt)}`);
  } else {
    writeLine(`  Eval:     ${chalk.gray('nincs')}`);
  }

  writeLine();
}

async function choosePromotableModel(): Promise<ReflexModelRecord | null> {
  const overview = await apiFetch<LearningLoopOverview>('/overview');
  const models = [
    ...overview.registry.candidateModels,
    ...overview.registry.shadowModels,
  ].filter((model) => Boolean(model.evalResultId));

  if (models.length === 0) {
    writeLine(chalk.yellow('\n⚠ Nincs promotálható eval-ozott modell.\n'));
    return null;
  }

  const { modelId } = await inquirer.prompt<{ modelId: string }>([
    {
      type: 'list',
      name: 'modelId',
      message: 'Melyik modellt szeretnéd promotálni?',
      choices: models.map((model) => ({
        name: `${model.version} [${model.state}]${model.avgScore !== undefined ? ` • score ${model.avgScore.toFixed(2)}` : ''}`,
        value: model.modelId,
      })),
    },
  ]);

  return models.find((model) => model.modelId === modelId) ?? null;
}

async function chooseRollbackTarget(): Promise<string | undefined> {
  const overview = await apiFetch<LearningLoopOverview>('/overview');
  const choices = [
    { name: 'Automatikus shadow fallback', value: '__AUTO__' },
    ...overview.registry.shadowModels.map((model) => ({
      name: `${model.version}${model.avgScore !== undefined ? ` • score ${model.avgScore.toFixed(2)}` : ''}`,
      value: model.modelId,
    })),
  ];

  const { target } = await inquirer.prompt<{ target: string }>([
    {
      type: 'list',
      name: 'target',
      message: 'Rollback célmodell:',
      choices,
    },
  ]);

  return target === '__AUTO__' ? undefined : target;
}

async function runWithSpinner<T>(label: string, work: () => Promise<T>): Promise<T | null> {
  const spinner = ora(label).start();
  try {
    const result = await work();
    spinner.succeed(chalk.green('Kész.'));
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(message));
    logError('CLI', `Learning Loop command failed: ${message}`);
    return null;
  }
}

async function showMenu(): Promise<void> {
  let exit = false;

  while (!exit) {
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Tanulókör művelet választása',
        choices: [
          { name: 'Áttekintés', value: 'overview' },
          { name: 'Kurált snapshot készítés', value: 'snapshot' },
          { name: 'Nightly tréning indítása', value: 'train' },
          { name: 'Eval futtatása candidate modellre', value: 'eval' },
          { name: 'Teljes Learning Loop ciklus futtatása', value: 'cycle' },
          { name: 'Reflex modell promotálása', value: 'promote' },
          { name: 'Rollback shadow modellre', value: 'rollback' },
          { name: 'Kilépés', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'overview': {
        const data = await runWithSpinner('Learning Loop áttekintés betöltése...', () => apiFetch<LearningLoopOverview>('/overview'));
        if (data) printOverview(data);
        break;
      }
      case 'snapshot': {
        await runWithSpinner('Kurált snapshot készítése...', () => apiFetch('/snapshot', {
          method: 'POST',
          body: JSON.stringify({ minQuality: 0.7 }),
        }));
        break;
      }
      case 'train': {
        const { dryRun } = await inquirer.prompt<{ dryRun: boolean }>([
          {
            type: 'confirm',
            name: 'dryRun',
            message: 'Dry-run módban fusson a tréning?',
            default: false,
          },
        ]);

        await runWithSpinner('Nightly tréning indítása...', () => apiFetch('/train', {
          method: 'POST',
          body: JSON.stringify({ dryRun }),
        }));
        break;
      }
      case 'eval': {
        const overview = await runWithSpinner('Candidate modellek betöltése...', () => apiFetch<LearningLoopOverview>('/overview'));
        const candidate = overview?.registry.candidateModels[0];
        if (!candidate) {
          writeLine(chalk.yellow('\n⚠ Nincs candidate modell eval futtatáshoz.\n'));
          break;
        }

        await runWithSpinner('Eval harness futtatása...', () => apiFetch('/evaluate', {
          method: 'POST',
          body: JSON.stringify({ modelId: candidate.modelId }),
        }));
        break;
      }
      case 'cycle': {
        const answers = await inquirer.prompt<{ dryRun: boolean; promotePassed: boolean }>([
          {
            type: 'confirm',
            name: 'dryRun',
            message: 'Dry-run módban fusson a teljes ciklus?',
            default: false,
          },
          {
            type: 'confirm',
            name: 'promotePassed',
            message: 'Automatikus promóció, ha az eval passed?',
            default: false,
          },
        ]);

        await runWithSpinner('Learning Loop ciklus futtatása...', () => apiFetch('/cycle', {
          method: 'POST',
          body: JSON.stringify(answers),
        }));
        break;
      }
      case 'promote': {
        const model = await choosePromotableModel();
        if (!model) break;
        await runWithSpinner(`Reflex modell promóció: ${model.version}`, () => apiFetch(`/models/${model.modelId}/promote`, {
          method: 'POST',
        }));
        break;
      }
      case 'rollback': {
        const targetModelId = await chooseRollbackTarget();
        await runWithSpinner('Rollback végrehajtása...', () => apiFetch('/rollback', {
          method: 'POST',
          body: JSON.stringify({ targetModelId }),
        }));
        break;
      }
      case 'exit':
      default:
        exit = true;
        break;
    }
  }
}

export function registerLearningLoopCommands(program: Command): void {
  const learningLoop = program
    .command('tanulokor')
    .alias('learning-loop')
    .description('Learning Loop és reflex modellek kezelése');

  learningLoop
    .command('status')
    .description('Learning Loop áttekintés megjelenítése')
    .action(async () => {
      const data = await runWithSpinner('Learning Loop áttekintés betöltése...', () => apiFetch<LearningLoopOverview>('/overview'));
      if (data) {
        printOverview(data);
      }
    });

  learningLoop
    .command('menu')
    .description('Interaktív tanulókör menü')
    .action(async () => {
      await showMenu();
    });

  learningLoop.action(async () => {
    await showMenu();
  });
}
