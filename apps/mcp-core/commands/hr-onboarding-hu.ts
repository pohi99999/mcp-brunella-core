import fs from 'fs/promises';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeLine } from '../../utils/cliOutput.js';
import {
  getHROnboardingJobs,
  getHROnboardingSamples,
  runHROnboardingDryRun,
  type HROnboardingJobRecord,
} from '../../dashboard/lib/hrOnboardingApi.js';
import type {
  HROnboardingDryRunReport,
  HROnboardingDryRunResult,
  HROnboardingSamplePayload,
} from '../../utils/hrOnboardingDryRun.js';

type DryRunOptions = {
  sample?: string;
  json?: string;
  file?: string;
  source?: string;
};

interface JsonJobPayload extends Record<string, unknown> {
  report?: HROnboardingDryRunReport;
  normalized?: HROnboardingDryRunResult['normalized'];
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('hu-HU');
}

function parseJobReport(job: HROnboardingJobRecord | undefined): JsonJobPayload | null {
  if (!job?.results_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(job.results_json) as JsonJobPayload;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadPayloadFromOptions(options: DryRunOptions): Promise<Record<string, unknown>> {
  if (options.json) {
    const parsed = JSON.parse(options.json) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('A --json értéke objektum kell legyen.');
    }

    return { ...parsed, source: options.source ?? parsed.source ?? 'cli' };
  }

  if (options.file) {
    const content = await fs.readFile(options.file, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('A payload fájl nem objektum.');
    }

    return { ...parsed, source: options.source ?? parsed.source ?? 'cli' };
  }

  const samples = await getHROnboardingSamples();
  if (samples.length === 0) {
    throw new Error('Nincs elérhető onboarding minta.');
  }

  let selected: HROnboardingSamplePayload | undefined;
  if (options.sample) {
    selected = samples.find((sample) => sample.key === options.sample);
    if (!selected) {
      throw new Error(`Ismeretlen minta: ${options.sample}`);
    }
  } else if (samples.length === 1) {
    selected = samples[0];
  } else {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'sampleKey',
        message: 'Melyik onboarding mintát használjam?',
        choices: samples.map((sample) => ({
          name: `${sample.label} (${sample.key})`,
          value: sample.key,
        })),
      },
    ]);
    selected = samples.find((sample) => sample.key === answer.sampleKey);
  }

  if (!selected) {
    throw new Error('Nem sikerült kiválasztani az onboarding mintát.');
  }

  return { ...selected.payload, source: options.source ?? selected.payload.source ?? 'cli' };
}

function renderSample(sample: HROnboardingSamplePayload): string {
  return boxen(
    `${chalk.bold(sample.key)} · ${sample.label}\n${chalk.dim(sample.description)}\n\n${JSON.stringify(sample.payload, null, 2)}`,
    {
      borderColor: 'cyan',
      padding: 1,
    },
  );
}

function renderReport(report: HROnboardingDryRunReport): string {
  const integrationLines = report.integrations
    .map((integration) => {
      const status = integration.available ? chalk.green('ready') : chalk.yellow('setup');
      return `• ${integration.channel}: ${status} — ${integration.details}`;
    })
    .join('\n');

  const checklistLines = report.checklist
    .map((item) => {
      const stateColor =
        item.state === 'ready'
          ? chalk.green
          : item.state === 'blocked'
            ? chalk.red
            : chalk.yellow;
      return `• ${item.label}: ${stateColor(item.state)}\n  ${chalk.dim(item.details)}`;
    })
    .join('\n');

  const missing = report.missing.length > 0
    ? `\n\nHiányzik:\n${report.missing.map((item) => `• ${item}`).join('\n')}`
    : '';

  const nextSteps = report.nextSteps.length > 0
    ? `\n\nKövetkező lépések:\n${report.nextSteps.map((item) => `• ${item}`).join('\n')}`
    : '';

  return boxen(
    [
      `${chalk.bold(report.status.toUpperCase())} · ${report.summary.ready}/${report.summary.total} ready`,
      '',
      `Timestamp: ${report.timestamp}`,
      `Blocked: ${report.summary.blocked}`,
      '',
      chalk.bold('Integrations'),
      integrationLines || chalk.dim('Nincs integrációs adat.'),
      '',
      chalk.bold('Checklist'),
      checklistLines || chalk.dim('Nincs checklist.'),
      missing,
      nextSteps,
    ]
      .filter(Boolean)
      .join('\n'),
    {
      borderColor: report.status === 'ready' ? 'green' : 'yellow',
      padding: 1,
    },
  );
}

export async function hrOnboardingCommand(): Promise<void> {
  writeLine(
    boxen(chalk.cyan.bold('🧑‍💼 HR Onboarding & Provisioning'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
    }),
  );

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Mit szeretnél?',
      choices: [
        { name: '📦 Minták listázása', value: 'mintak' },
        { name: '🚀 Dry-run futtatása', value: 'futtat' },
        { name: '📊 Job állapot', value: 'allapot' },
        { name: '↩ Vissza', value: 'back' },
      ],
    },
  ]);

  if (action === 'mintak') {
    await hrOnboardingSamplesCommand();
  } else if (action === 'futtat') {
    await hrOnboardingDryRunCommand({ source: 'menu' });
  } else if (action === 'allapot') {
    await hrOnboardingStatusCommand();
  }
}

export async function hrOnboardingSamplesCommand(): Promise<void> {
  const spinner = ora('HR onboarding mintak betoltese...').start();

  try {
    const samples = await getHROnboardingSamples();
    spinner.stop();

    if (samples.length === 0) {
      writeLine(chalk.yellow('Nincs elerheto onboarding minta.'));
      return;
    }

    writeLine(chalk.cyan(`\n═══ HR ONBOARDING MINTÁK (${samples.length}) ═══\n`));
    for (const sample of samples) {
      writeLine(renderSample(sample));
      writeLine();
    }
  } catch (error: unknown) {
    spinner.fail('Nem sikerült lekérni a mintákat.');
    writeError(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

export async function hrOnboardingDryRunCommand(options: DryRunOptions): Promise<void> {
  const payload = await loadPayloadFromOptions(options);
  const name = typeof payload.employeeName === 'string'
    ? payload.employeeName
    : typeof payload.name === 'string'
      ? payload.name
      : 'HR onboarding';

  const spinner = ora(`HR onboarding dry-run: ${name}...`).start();

  try {
    const response = await runHROnboardingDryRun(payload);
    spinner.stop();

    writeLine(
      boxen(
        `${chalk.bold('Job ID:')} ${response.jobId}\n${chalk.bold('Állapot:')} ${response.report.status.toUpperCase()}\n${chalk.bold('Dolgozó:')} ${name}`,
        {
          borderColor: response.report.status === 'ready' ? 'green' : 'yellow',
          padding: 1,
        },
      ),
    );
    writeLine();
    writeLine(renderReport(response.report));
  } catch (error: unknown) {
    spinner.fail('A dry-run nem futott le.');
    writeError(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

export async function hrOnboardingStatusCommand(limit = 5): Promise<void> {
  const spinner = ora('HR onboarding jobok betoltese...').start();

  try {
    const jobs = await getHROnboardingJobs(limit);
    spinner.stop();

    if (jobs.length === 0) {
      writeLine(chalk.yellow('Nincs még onboarding dry-run job.'));
      return;
    }

    writeLine(chalk.blue(`\n═══ HR ONBOARDING ÁLLAPOT (${jobs.length}) ═══\n`));
    for (const job of jobs) {
      const parsed = parseJobReport(job);
      const report = parsed?.report;
      const statusColor = job.status === 'completed' ? chalk.green : job.status === 'blocked' ? chalk.red : chalk.yellow;
      writeLine(`${chalk.bold(job.query)} · ${statusColor(job.status)} · ${formatDate(job.created_at)}`);
      if (report) {
        writeLine(`  ${report.status.toUpperCase()} · ready ${report.summary.ready}/${report.summary.total} · blocked ${report.summary.blocked}`);
      }
      writeLine();
    }
  } catch (error: unknown) {
    spinner.fail('Nem sikerült lekérni a jobokat.');
    writeError(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
