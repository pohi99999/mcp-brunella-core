/* eslint-disable no-console */

import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

interface SuggestedTask {
  id: string;
  file_path: string;
  line_number: number;
  todo_text: string;
  context: string;
  confidence_score: number;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1/suggested-tasks${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const err =
      typeof data === 'object' && data !== null && 'error' in data
        ? (data as Record<string, unknown>).error
        : `HTTP ${response.status}`;
    throw new Error(String(err));
  }

  return data;
}

function confidenceColor(score: number): (text: string) => string {
  if (score >= 0.8) return chalk.red.bold;
  if (score >= 0.65) return chalk.yellow.bold;
  return chalk.green;
}

function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    pending: chalk.yellow('● PENDING'),
    in_progress: chalk.blue('● IN_PROGRESS'),
    completed: chalk.green('✓ DONE'),
    archived: chalk.gray('✗ ARCHIVED'),
  };
  return badges[status] || chalk.gray(status);
}

export function registerSuggestedTasksCommands(program: Command): void {
  const suggestedCmd = program
    .command('suggested-tasks')
    .alias('todos')
    .description('Manage suggested tasks (TODOs/FIXMEs in codebase)');

  // scan-todos subcommand
  suggestedCmd
    .command('scan')
    .description('Scan codebase for TODOs/FIXMEs')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options) => {
      const spinner = ora('Scanning codebase for TODOs...').start();

      try {
        const response = await apiFetch<{
          count: number;
          tasks: SuggestedTask[];
        }>('/scan', { method: 'POST' });

        spinner.succeed(
          `Found ${chalk.cyan(String(response.count))} TODOs/FIXMEs`,
        );

        if (response.count > 0) {
          console.log();
          console.log(chalk.bold('📋 Summary by confidence:'));

          // Group by confidence
          const byConfidence = response.tasks.reduce(
            (acc, task) => {
              const bucket = Math.round(task.confidence_score * 100);
              if (!acc[bucket]) acc[bucket] = [];
              acc[bucket].push(task);
              return acc;
            },
            {} as Record<number, SuggestedTask[]>,
          );

          Object.entries(byConfidence)
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
            .forEach(([bucket, tasks]) => {
              const score = parseInt(bucket) / 100;
              const count = tasks.length;
              const bar = confidenceColor(score)(
                `${'▓'.repeat(Math.round(score * 20))}${'░'.repeat(20 - Math.round(score * 20))}`,
              );
              console.log(`  ${bar} ${chalk.bold(String(count))} items (${score.toFixed(2)})`);
            });

          if (options.verbose) {
            console.log();
            console.log(chalk.bold('📄 Details:'));
            response.tasks
              .sort((a, b) => b.confidence_score - a.confidence_score)
              .slice(0, 10)
              .forEach((task) => {
                console.log(
                  `  ${confidenceColor(task.confidence_score)(
                    `[${(task.confidence_score * 100).toFixed(0)}%]`,
                  )} ${chalk.cyan(task.file_path)}:${task.line_number}`,
                );
                console.log(
                  `    ${chalk.gray('→')} ${task.todo_text.substring(0, 60)}`,
                );
              });
          }
        }
      } catch (err: unknown) {
        spinner.fail(
          `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  // list subcommand
  suggestedCmd
    .command('list [status]')
    .description(
      'List tasks by status (pending, in_progress, completed, archived)',
    )
    .option('-l, --limit <n>', 'Limit results', '20')
    .action(async (status, options) => {
      const spinner = ora('Loading tasks...').start();

      try {
        let path = '';
        if (status) {
          path = `/${status}`;
        }

        const response = await apiFetch<SuggestedTask[]>(path);

        spinner.stop();

        const tasks = response
          .sort((a, b) => b.confidence_score - a.confidence_score)
          .slice(0, parseInt(options.limit));

        if (tasks.length === 0) {
          console.log(chalk.yellow('No tasks found.'));
          return;
        }

        console.log();
        console.log(chalk.bold(`📋 Tasks (${tasks.length} shown):`));
        console.log();

        tasks.forEach((task, idx) => {
          const scoreColor =
            task.confidence_score >= 0.8
              ? chalk.red
              : task.confidence_score >= 0.65
                ? chalk.yellow
                : chalk.green;
          console.log(
            `${idx + 1}. ${scoreColor(`[${(task.confidence_score * 100).toFixed(0)}%]`)} ${chalk.cyan(task.file_path)}:${task.line_number}`,
          );
          console.log(
            `   ${statusBadge(task.status)} ${task.assigned_to ? `→ ${task.assigned_to}` : 'unassigned'}`,
          );
          console.log(
            `   ${chalk.gray('→')} ${task.todo_text.substring(0, 70)}`,
          );
          console.log();
        });
      } catch (err: unknown) {
        spinner.fail(
          `Failed to load tasks: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  // status subcommand
  suggestedCmd
    .command('status')
    .description('Show statistics about all tasks')
    .action(async () => {
      const spinner = ora('Loading statistics...').start();

      try {
        const response = await apiFetch<SuggestedTask[]>('');

        spinner.stop();

        const stats = {
          total: response.length,
          pending: response.filter((t) => t.status === 'pending').length,
          in_progress: response.filter((t) => t.status === 'in_progress').length,
          completed: response.filter((t) => t.status === 'completed').length,
          archived: response.filter((t) => t.status === 'archived').length,
          avg_confidence:
            response.length > 0
              ? (
                  response.reduce((sum, t) => sum + t.confidence_score, 0) /
                  response.length
                ).toFixed(2)
              : '0',
          critical: response.filter((t) => t.confidence_score >= 0.8).length,
        };

        console.log();
        console.log(chalk.bold('📊 Task Statistics:'));
        console.log();
        console.log(
          `  Total Tasks:      ${chalk.cyan(String(stats.total))}`,
        );
        console.log(
          `  Pending:          ${chalk.yellow(String(stats.pending))}`,
        );
        console.log(
          `  In Progress:      ${chalk.blue(String(stats.in_progress))}`,
        );
        console.log(
          `  Completed:        ${chalk.green(String(stats.completed))}`,
        );
        console.log(
          `  Archived:         ${chalk.gray(String(stats.archived))}`,
        );
        console.log();
        console.log(
          `  Avg. Confidence:  ${stats.avg_confidence}`,
        );
        console.log(
          `  Critical (>80%):  ${chalk.red.bold(String(stats.critical))}`,
        );
        console.log();
      } catch (err: unknown) {
        spinner.fail(
          `Failed to load stats: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });
}
