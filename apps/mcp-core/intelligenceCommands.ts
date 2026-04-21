import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import type {
  IntelligenceDomain,
  IntelligenceOverview,
  IntelligenceSignalInput,
  IntelligenceSignalRecord,
  IntelligenceSourceClass,
} from '@packages/core-logic/intelligenceMonitor.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

type TableCell = string | number | boolean | null | undefined;
type TableRow = Record<string, TableCell>;

interface AddSignalAnswers {
  sourceClass: IntelligenceDomain;
  source: string;
  title: string;
  summary: string;
  entity: string;
  relation: string;
  stance: 'supports' | 'contradicts' | 'neutral';
  biasLabel: 'low' | 'medium' | 'high' | 'unknown';
  provenance: string;
  confidence: number;
}

interface WatchActionAnswer {
  action: 'overview' | 'add' | 'review' | 'exit';
}

interface ReviewSignalAnswer {
  signalId: string;
}

interface ReviewDecisionAnswer {
  decision: 'approve' | 'reject';
}

interface ReviewNoteAnswer {
  note: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function writeTable(rows: TableRow[]): void {
  if (rows.length === 0) {
    return;
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key);
      }

      return set;
    }, new Set<string>()),
  );
  const normalizedRows = rows.map((row) =>
    headers.map((header) => {
      const value = row[header];
      return value === null || value === undefined ? '' : String(value);
    }),
  );
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...normalizedRows.map((row) => row[index]?.length ?? 0)),
  );
  const formatRow = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(' | ');

  writeLine(formatRow(headers));
  writeLine(widths.map((width) => '-'.repeat(width)).join('-|-'));
  for (const row of normalizedRows) {
    writeLine(formatRow(row));
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

function printOverview(overview: IntelligenceOverview): void {
  writeLine(boxen(chalk.bold.cyan('🧠 Intelligence Watch — Overview'), { padding: 1, borderColor: 'cyan' }));
  writeLine(chalk.gray(`Generated: ${new Date(overview.generatedAt).toLocaleString()}`));
  writeLine();

  writeTable([
    {
      Metric: 'Signals',
      Total: overview.signals.total,
      Pending: overview.signals.pendingReview,
      Approved: overview.signals.approved,
      Promoted: overview.signals.promoted,
      Rejected: overview.signals.rejected,
    },
    {
      Metric: 'Golden Dataset',
      Total: overview.stats.golden?.totalSamples ?? 0,
      New: overview.stats.golden?.newSinceLastTraining ?? 0,
      LastTraining: overview.stats.golden?.lastTrainingAt ?? '—',
      AvgScore: overview.feedback.avgScore.toFixed(2),
    },
    {
      Metric: 'Memory',
      Total: overview.stats.memory.summary.totalEntries,
      AvgConfidence: overview.stats.memory.summary.avgConfidence.toFixed(2),
      Reuses: overview.stats.memory.summary.totalReuses,
      Contradictions: overview.feedback.contradictionCount,
    },
    {
      Metric: 'Index / Tools',
      FilesIndexed: overview.stats.index.lastStats?.fileCount ?? 0,
      ChunksIndexed: overview.stats.index.lastStats?.chunkCount ?? 0,
      ToolRuns: overview.stats.tools.totalRuns,
      SuccessRate: `${overview.stats.tools.successRate.toFixed(1)}%`,
      SchedulerActive: overview.stats.index.schedulerActive ? 'yes' : 'no',
    },
  ]);
  writeLine();

  writeLine(chalk.bold('Guardrails:'));
  for (const guardrail of overview.governance.guardrails) {
    writeLine(`  ${chalk.green('•')} ${guardrail}`);
  }

  if (overview.reviewQueue.length > 0) {
    writeLine();
    writeLine(chalk.bold('Review queue:'));
    for (const signal of overview.reviewQueue) {
      writeLine(`  ${chalk.yellow('•')} ${signal.title} ${chalk.gray(`(${signal.sourceClass}, ${signal.score.toFixed(2)})`)}`);
    }
  }
}

function printSignals(signals: IntelligenceSignalRecord[]): void {
  if (signals.length === 0) {
    writeLine(chalk.yellow('Nincs elérhető jelzés.'));
    return;
  }

  writeTable(
    signals.map((signal) => ({
      ID: signal.id,
      Class: signal.sourceClass,
      Title: signal.title.slice(0, 48),
      Score: signal.score.toFixed(2),
      Status: signal.status,
      Stance: signal.stance,
      Updated: new Date(signal.updatedAt).toLocaleString(),
    })),
  );
}

async function addSignalInteractive(sourceClasses: IntelligenceSourceClass[]): Promise<void> {
  const answers = await inquirer.prompt<AddSignalAnswers>([
    { type: 'list', name: 'sourceClass', message: 'Jelzés osztálya:', choices: sourceClasses.map((cls) => ({ name: `${cls.label} (${cls.id})`, value: cls.id })) },
    { type: 'input', name: 'source', message: 'Forrás neve / URL-je:' },
    { type: 'input', name: 'title', message: 'Cím:' },
    { type: 'input', name: 'summary', message: 'Rövid összefoglaló:' },
    { type: 'input', name: 'entity', message: 'Entity (opcionális):', default: '' },
    { type: 'input', name: 'relation', message: 'Relation (opcionális):', default: '' },
    { type: 'list', name: 'stance', message: 'Stance:', choices: [
      { name: 'supports', value: 'supports' },
      { name: 'contradicts', value: 'contradicts' },
      { name: 'neutral', value: 'neutral' },
    ] },
    { type: 'list', name: 'biasLabel', message: 'Bias label:', choices: [
      { name: 'low', value: 'low' },
      { name: 'medium', value: 'medium' },
      { name: 'high', value: 'high' },
      { name: 'unknown', value: 'unknown' },
    ] },
    { type: 'input', name: 'provenance', message: 'Provenance / bizonyítás:', default: '' },
    { type: 'number', name: 'confidence', message: 'Confidence (0-1):', default: 0.6 },
  ]);

  const payload: IntelligenceSignalInput = {
    sourceClass: answers.sourceClass,
    source: answers.source,
    title: answers.title,
    summary: answers.summary,
    entity: answers.entity?.trim() || undefined,
    relation: answers.relation?.trim() || undefined,
    stance: answers.stance,
    biasLabel: answers.biasLabel,
    provenance: answers.provenance,
    confidence: typeof answers.confidence === 'number' ? answers.confidence : 0.6,
  };

  const spinner = ora('Jelzés mentése...').start();
  try {
    const saved = await apiFetch<IntelligenceSignalRecord>('/api/v1/intelligence/signals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    spinner.succeed(chalk.green(`Mentve: ${saved.title}`));
    writeLine(chalk.gray(`  Status: ${saved.status} | Score: ${saved.score.toFixed(2)}`));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Jelzés mentése sikertelen'));
    writeError(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function reviewQueueInteractive(): Promise<void> {
  const spinner = ora('Review queue betöltése...').start();
  try {
    const signals = await apiFetch<IntelligenceSignalRecord[]>('/api/v1/intelligence/review-queue?limit=12');
    spinner.stop();
    if (signals.length === 0) {
      writeLine(chalk.green('Nincs review-ra váró jelzés.'));
      return;
    }

    printSignals(signals);
    const { signalId } = await inquirer.prompt<ReviewSignalAnswer>([
      {
        type: 'list',
        name: 'signalId',
        message: 'Melyik jelzést szeretnéd review-zni?',
        choices: signals.map((signal) => ({ name: `${signal.title} (${signal.sourceClass} | ${signal.score.toFixed(2)})`, value: signal.id })),
      },
    ]);

    const { decision } = await inquirer.prompt<ReviewDecisionAnswer>([
      {
        type: 'list',
        name: 'decision',
        message: 'Review döntés:',
        choices: [
          { name: 'Jóváhagyás és promotion', value: 'approve' },
          { name: 'Elutasítás', value: 'reject' },
        ],
      },
    ]);

    const { note } = await inquirer.prompt<ReviewNoteAnswer>([
      { type: 'input', name: 'note', message: 'Megjegyzés / indoklás (opcionális):', default: '' },
    ]);

    const reviewSpinner = ora('Review mentése...').start();
    const updated = await apiFetch<IntelligenceSignalRecord>(`/api/v1/intelligence/review/${signalId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
    reviewSpinner.succeed(chalk.green(`Kész: ${updated.title} -> ${updated.status}`));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Review queue betöltése sikertelen'));
    writeError(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function runInteractiveWatch(): Promise<void> {
  while (true) {
    const { action } = await inquirer.prompt<WatchActionAnswer>([
      {
        type: 'list',
        name: 'action',
        message: 'Intelligence Watch — válassz műveletet',
        choices: [
          { name: 'Áttekintés', value: 'overview' },
          { name: 'Új jelzés rögzítése', value: 'add' },
          { name: 'Review queue', value: 'review' },
          { name: 'Kilépés', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      return;
    }
    if (action === 'overview') {
      const overview = await apiFetch<IntelligenceOverview>('/api/v1/intelligence/overview');
      printOverview(overview);
      continue;
    }
    if (action === 'add') {
      const overview = await apiFetch<IntelligenceOverview>('/api/v1/intelligence/overview');
      await addSignalInteractive(overview.governance.sourceClasses);
      continue;
    }
    if (action === 'review') {
      await reviewQueueInteractive();
    }
  }
}

export function registerIntelligenceCommands(program: Command): void {
  const intelligence = program.command('intelligence').description('Intelligence monitoring and curation commands');

  intelligence
    .command('watch')
    .alias('figyelj')
    .description('Intelligence Monitor futtatása és review támogatás')
    .option('--json', 'JSON kimenet')
    .option('--once', 'Egyszeri áttekintés, prompt nélkül')
    .action(async (options: { json?: boolean; once?: boolean }) => {
      try {
        if (options.json) {
          const overview = await apiFetch<IntelligenceOverview>('/api/v1/intelligence/overview');
          writeLine(JSON.stringify(overview, null, 2));
          return;
        }

        if (!process.stdin.isTTY || options.once) {
          const spinner = ora('Intelligence overview betöltése...').start();
          const overview = await apiFetch<IntelligenceOverview>('/api/v1/intelligence/overview');
          spinner.stop();
          printOverview(overview);
          return;
        }

        await runInteractiveWatch();
      } catch (error: unknown) {
        writeError(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
    });
}

