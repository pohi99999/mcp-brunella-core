import type { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';

import { getHookObservabilitySnapshot, type HookObservabilitySnapshot } from '../dashboard/lib/apiService.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logInfo } from '@packages/utils/logger.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonValue(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('A JSON értéknek objektumnak kell lennie.');
  }

  return parsed as Record<string, unknown>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text.trim().length > 0 ? JSON.parse(text) as T : ({} as T);

  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as Record<string, unknown>).error ?? `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new Error(error);
  }

  return payload;
}

function renderSummary(snapshot: HookObservabilitySnapshot): string {
  const summary = snapshot.summary;
  const failureRate = (summary.audit.failureRate * 100).toFixed(1);

  const lines = [
    chalk.bold('🪝 Hook Engine Snapshot'),
    '',
    `  Window:          ${chalk.cyan(`last ${summary.windowHours}h`)}`,
    `  Executions:      ${chalk.cyan(summary.audit.total)}`,
    `  Failure rate:    ${summary.audit.failed > 0 ? chalk.yellow(`${failureRate}%`) : chalk.green(`${failureRate}%`)}`,
    `  Registry size:   ${chalk.cyan(summary.registrySize)}`,
    `  Enabled hooks:   ${chalk.cyan(summary.enabledHandlers)}`,
    `  Open circuits:   ${summary.circuitOpenCount > 0 ? chalk.yellow(summary.circuitOpenCount) : chalk.green(summary.circuitOpenCount)}`,
    `  DLQ entries:     ${summary.dlqCount > 0 ? chalk.yellow(summary.dlqCount) : chalk.green(summary.dlqCount)}`,
    '',
    chalk.bold('Recent events:'),
  ];

  if (snapshot.executions.length === 0) {
    lines.push(`  ${chalk.gray('No hook executions yet.')}`);
  } else {
    for (const execution of snapshot.executions.slice(0, 5)) {
      lines.push(`  ${chalk.gray(execution.createdAt.slice(0, 19))} ${chalk.blue(execution.event)} ${chalk.gray(execution.handlerName)} ${chalk.yellow(execution.status)}`);
    }
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
  });
}

function renderRegistry(snapshot: HookObservabilitySnapshot): string {
  const lines = [
    chalk.bold('🧭 Hook Registry'),
    '',
  ];

  if (snapshot.registry.length === 0) {
    lines.push(`  ${chalk.gray('No hook registrations.')}`);
  } else {
    for (const entry of snapshot.registry) {
      const state = entry.enabled ? chalk.green('enabled') : chalk.red('disabled');
      lines.push(`  ${chalk.blue(entry.event)} ${state} ${chalk.gray(`(${entry.category}, p${entry.priority}, ${entry.handlerCount} handlers)`)}`);
    }
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'blue',
  });
}

function renderExecutions(snapshot: HookObservabilitySnapshot): string {
  const lines = [
    chalk.bold('📜 Hook Executions'),
    '',
  ];

  if (snapshot.executions.length === 0) {
    lines.push(`  ${chalk.gray('No executions to show.')}`);
  } else {
    for (const execution of snapshot.executions) {
      lines.push(`  ${chalk.gray(execution.createdAt.slice(0, 19))} ${chalk.blue(execution.event)} ${chalk.gray(execution.handlerName)} ${chalk.yellow(execution.status)} ${chalk.gray(`${execution.durationMs}ms`)}`);
    }
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'magenta',
  });
}

function renderDlq(entries: Array<{ id: number; event: string; reason: string; attempts: number; nextRetryAt: string; status: string }>): string {
  const lines = [
    chalk.bold('🧱 Dead Letter Queue'),
    '',
  ];

  if (entries.length === 0) {
    lines.push(`  ${chalk.green('DLQ is empty.')}`);
  } else {
    for (const entry of entries) {
      lines.push(`  #${entry.id} ${chalk.blue(entry.event)} ${chalk.gray(entry.reason.slice(0, 60))} ${chalk.yellow(entry.status)} ${chalk.gray(`attempts=${entry.attempts}`)}`);
    }
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'yellow',
  });
}

export function registerHookCommands(program: Command): void {
  const hooks = program
    .command('hooks')
    .alias('hook')
    .description('Hook engine observability and control');

  hooks
    .command('summary')
    .alias('status')
    .description('Hook snapshot summary')
    .option('--hours <count>', 'Időablak órában', '24')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { hours?: string; json?: boolean }) => {
      try {
        const hours = parseInteger(opts.hours, 24);
        const snapshot = await getHookObservabilitySnapshot(hours);

        if (opts.json) {
          writeLine(JSON.stringify(snapshot.snapshot, null, 2));
          return;
        }

        writeLine(renderSummary(snapshot.snapshot));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('list')
    .alias('registry')
    .description('List all hook registrations')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      try {
        const snapshot = await getHookObservabilitySnapshot(24);

        if (opts.json) {
          writeLine(JSON.stringify(snapshot.snapshot.registry, null, 2));
          return;
        }

        writeLine(renderRegistry(snapshot.snapshot));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('executions')
    .alias('log')
    .description('Recent hook execution log')
    .option('-n, --limit <count>', 'Maximum elemszám', '20')
    .option('--json', 'Nyers JSON kimenet')
    .action(async (opts: { limit?: string; json?: boolean }) => {
      try {
        const snapshot = await getHookObservabilitySnapshot(24);
        const limit = parseInteger(opts.limit, 20);
        const executions = snapshot.snapshot.executions.slice(0, limit);

        if (opts.json) {
          writeLine(JSON.stringify(executions, null, 2));
          return;
        }

        writeLine(renderExecutions({ ...snapshot.snapshot, executions }));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('dlq')
    .description('Dead letter queue entries')
    .option('-n, --limit <count>', 'Maximum elemszám', '20')
    .option('--json', 'Nyers JSON kimenet')
    .action(async (opts: { limit?: string; json?: boolean }) => {
      try {
        const limit = parseInteger(opts.limit, 20);
        const response = await fetchJson<{ success: boolean; dlq: Array<{ id: number; event: string; reason: string; attempts: number; nextRetryAt: string; status: string }> }>(
          `${process.env.BRUNELLA_API_URL || 'http://localhost:3000'}/api/v1/hooks/dlq?limit=${limit}`,
        );

        if (opts.json) {
          writeLine(JSON.stringify(response.dlq, null, 2));
          return;
        }

        writeLine(renderDlq(response.dlq));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('fire <event>')
    .description('Manually fire a hook event')
    .option('--payload <json>', 'JSON payload')
    .option('--metadata <json>', 'JSON metadata')
    .option('--source <name>', 'Source label', 'cli')
    .option('--force', 'Bypass disabled hooks')
    .action(async (event: string, opts: { payload?: string; metadata?: string; source?: string; force?: boolean }) => {
      try {
        const body = {
          event,
          payload: parseJsonValue(opts.payload),
          metadata: parseJsonValue(opts.metadata),
          source: opts.source ?? 'cli',
          force: Boolean(opts.force),
        };

        const response = await fetchJson<{ success: boolean; summary: { status: string; firedCount: number; failedCount: number; deadLetterCount: number; retriedCount: number; errors: string[] } }>(
          `${process.env.BRUNELLA_API_URL || 'http://localhost:3000'}/api/v1/hooks/fire`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );

        logInfo('CLI', `Hook fired: ${event}`);
        writeLine(JSON.stringify(response.summary, null, 2));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('retry-dlq')
    .description('Retry a DLQ entry or the whole queue')
    .argument('[id]', 'DLQ entry id')
    .option('--all', 'Retry all pending DLQ entries')
    .action(async (id: string | undefined, opts: { all?: boolean }) => {
      try {
        const apiBase = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

        if (opts.all) {
          const response = await fetchJson<{ success: boolean; retried: number }>(`${apiBase}/api/v1/hooks/dlq/retry-all`, {
            method: 'POST',
          });
          writeLine(`Retried ${response.retried} DLQ entries.`);
          return;
        }

        if (!id) {
          throw new Error('Adjon meg DLQ entry id-t vagy használja a --all opciót.');
        }

        const response = await fetchJson<{ success: boolean; summary: { status: string; firedCount: number; failedCount: number; deadLetterCount: number } }>(
          `${apiBase}/api/v1/hooks/dlq/${encodeURIComponent(id)}/retry`,
          { method: 'POST' },
        );
        writeLine(JSON.stringify(response.summary, null, 2));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('enable <event>')
    .description('Enable a hook event')
    .action(async (event: string) => {
      try {
        const apiBase = process.env.BRUNELLA_API_URL || 'http://localhost:3000';
        const response = await fetchJson<{ success: boolean; enabled: boolean }>(
          `${apiBase}/api/v1/hooks/enable/${encodeURIComponent(event)}`,
          { method: 'POST' },
        );
        writeLine(JSON.stringify(response, null, 2));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });

  hooks
    .command('disable <event>')
    .description('Disable a hook event')
    .action(async (event: string) => {
      try {
        const apiBase = process.env.BRUNELLA_API_URL || 'http://localhost:3000';
        const response = await fetchJson<{ success: boolean; enabled: boolean }>(
          `${apiBase}/api/v1/hooks/disable/${encodeURIComponent(event)}`,
          { method: 'POST' },
        );
        writeLine(JSON.stringify(response, null, 2));
      } catch (error: unknown) {
        const normalized = ensureError(error);
        writeError(`Hiba: ${normalized.message}`);
        process.exit(1);
      }
    });
}

