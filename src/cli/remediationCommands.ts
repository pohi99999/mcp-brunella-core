import { Command } from 'commander';
import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';

import type { RemediationRunRecord, RemediationRunStatus } from '../core/remediationRuntime.types.js';
import { writeLine } from '../utils/cliOutput.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

interface RemediationSummaryResponse {
  summary: {
    total: number;
    counts: Partial<Record<RemediationRunStatus, number>>;
    active: boolean;
    latestUpdatedAt?: string;
    pendingFinalApproval: number;
  };
}

interface RemediationRunsResponse {
  count: number;
  runs: RemediationRunRecord[];
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('hu-HU');
}

function countFor(
  counts: Partial<Record<RemediationRunStatus, number>>,
  ...statuses: RemediationRunStatus[]
): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
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
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function printSummaryCard(summary: RemediationSummaryResponse['summary']): void {
  const counts = summary.counts ?? {};
  const lines = [
    chalk.bold.cyan('🧯 GitHub Remediation Runtime'),
    '',
    `Aktív runtime: ${summary.active ? chalk.green('igen') : chalk.red('nem')}`,
    `Összes futás: ${chalk.cyan(summary.total)}`,
    `Függő végső approval: ${chalk.yellow(summary.pendingFinalApproval)}`,
    `Utolsó frissítés: ${chalk.gray(formatTimestamp(summary.latestUpdatedAt))}`,
    '',
    chalk.bold('Állapotok:'),
    `  Sorban / elemzés: ${chalk.yellow(countFor(counts, 'queued', 'analyzing'))}`,
    `  Fix fut:          ${chalk.blue(counts.running_fixer ?? 0)}`,
    `  Verifikálás:      ${chalk.magenta(counts.verifying ?? 0)}`,
    `  Approvalra vár:   ${chalk.yellow(counts.awaiting_final_approval ?? 0)}`,
    `  Jóváhagyva:       ${chalk.green(counts.approved ?? 0)}`,
    `  Elutasítva / hiba:${chalk.red(countFor(counts, 'rejected', 'failed'))}`,
  ];

  writeLine(
    boxen(lines.join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: summary.active ? 'cyan' : 'red',
    }),
  );
}

function printRunsTable(runs: RemediationRunRecord[]): void {
  if (runs.length === 0) {
    writeLine(chalk.yellow('Nincs remediation futás.'));
    return;
  }

  console.table(
    runs.map((run) => ({
      ID: run.id.slice(0, 8),
      Status: run.status,
      Repo: run.repositoryName,
      Workflow: run.workflowName ?? run.workflowRunId ?? '—',
      Branch: run.branch ?? '—',
      Fixer: run.fixer?.agentName ?? '—',
      Approval: run.finalApproval?.status ?? '—',
      Updated: formatTimestamp(run.updatedAt),
    })),
  );
}

export function registerRemediationCommands(program: Command): void {
  const remediation = program
    .command('remediation')
    .alias('javitas')
    .description('GitHub remediation runtime állapot és futások');

  remediation
    .command('status')
    .alias('allapot')
    .description('Remediation runtime összegzés és legutóbbi futások')
    .option('--json', 'JSON kimenet')
    .action(async (options: { json?: boolean }) => {
      const spinner = ora('Remediation állapot lekérése...').start();
      try {
        const [summaryResponse, runsResponse] = await Promise.all([
          apiFetch<RemediationSummaryResponse>('/api/v1/zero-prompt/remediation-runs/summary'),
          apiFetch<RemediationRunsResponse>('/api/v1/zero-prompt/remediation-runs?limit=5'),
        ]);
        spinner.stop();

        if (options.json) {
          writeLine(JSON.stringify({ summary: summaryResponse.summary, runs: runsResponse.runs }, null, 2));
          return;
        }

        printSummaryCard(summaryResponse.summary);
        writeLine();
        printRunsTable(runsResponse.runs);
      } catch (error: unknown) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
    });

  remediation
    .command('runs')
    .alias('futasok')
    .description('Remediation futások listázása')
    .option('-s, --status <status>', 'Szűrés státuszra')
    .option('-n, --limit <count>', 'Maximum elemszám', '20')
    .option('--json', 'JSON kimenet')
    .action(async (options: { status?: string; limit?: string; json?: boolean }) => {
      const spinner = ora('Remediation futások lekérése...').start();
      try {
        const query = new URLSearchParams();
        query.set('limit', options.limit ?? '20');
        if (options.status) {
          query.set('status', options.status);
        }

        const response = await apiFetch<RemediationRunsResponse>(
          `/api/v1/zero-prompt/remediation-runs?${query.toString()}`,
        );
        spinner.stop();

        if (options.json) {
          writeLine(JSON.stringify(response, null, 2));
          return;
        }

        writeLine(
          boxen(chalk.bold(`🧯 Remediation futások (${response.count})`), {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
          }),
        );
        printRunsTable(response.runs);
      } catch (error: unknown) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
    });
}
