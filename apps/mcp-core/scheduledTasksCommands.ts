 

import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_status?: string;
  last_result?: string;
}

interface TriggerTaskResult {
  message: string;
  result?: Record<string, unknown>;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1/scheduled-tasks${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as { success?: boolean; data?: T; error?: string }) : {};

  if (!response.ok || (typeof data === 'object' && data.success === false)) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return (data.data as T) || (data as unknown as T);
}

export function registerScheduledTasksCommands(program: Command): void {
  const scheduleCmd = program
    .command('schedule')
    .alias('cron')
    .description('Manage scheduled AI tasks');

  // list
  scheduleCmd
    .command('list')
    .description('List all scheduled tasks')
    .action(async () => {
      const spinner = ora('Fetching scheduled tasks...').start();
      try {
        const tasks = await apiFetch<ScheduledTask[]>(''); // GET /
        spinner.stop();

        if (!tasks || tasks.length === 0) {
          writeLine(chalk.yellow('No scheduled tasks found.'));
          return;
        }

        writeLine(chalk.bold('📋 Scheduled Tasks:'));
        writeLine();
        
        tasks.forEach((t) => {
          const statusColor = t.last_status === 'success' ? chalk.green : t.last_status === 'failed' ? chalk.red : chalk.gray;
          const statusText = t.last_status === 'success' ? 'OK' : t.last_status === 'failed' ? 'FAIL' : '-';
          const lastRun = t.last_run_at ? new Date(t.last_run_at).toLocaleString() : 'Never';
          
          writeLine(`${chalk.cyan(t.title)} (ID: ${t.id.substring(0, 8)}...)`);
          writeLine(`  Cron:    ${chalk.yellow(t.cron_expression)}`);
          writeLine(`  Handler: ${t.handler}`);
          writeLine(`  Enabled: ${t.enabled ? chalk.green('Yes') : chalk.red('No')}`);
          writeLine(`  Last:    ${lastRun} [${statusColor(statusText)}]`);
          writeLine(chalk.dim('─'.repeat(40)));
        });
      } catch (err: unknown) {
        spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // add
  scheduleCmd
    .command('add <title> <cron> <prompt>')
    .description('Schedule a new AI task')
    .option('--handler <handler>', 'Handler type', 'default')
    .action(async (title, cron, prompt, options) => {
      const spinner = ora('Creating scheduled task...').start();
      try {
        const newTask = await apiFetch<ScheduledTask>('', {
          method: 'POST',
          body: JSON.stringify({
            title,
            cron_expression: cron,
            prompt,
            handler: options.handler,
          }),
        });
        spinner.succeed(`Task created: ${chalk.cyan(newTask.title)} (ID: ${newTask.id})`);
      } catch (err: unknown) {
        spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // remove
  scheduleCmd
    .command('remove <id>')
    .description('Remove a scheduled task')
    .action(async (id) => {
      const spinner = ora(`Removing task ${id}...`).start();
      try {
        await apiFetch(`/${id}`, { method: 'DELETE' });
        spinner.succeed('Task removed');
      } catch (err: unknown) {
        spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // run
  scheduleCmd
    .command('run <id>')
    .description('Trigger a scheduled task immediately')
    .action(async (id) => {
      const spinner = ora(`Triggering task ${id}...`).start();
      try {
        const result = await apiFetch<TriggerTaskResult>(`/${id}/trigger`, {
          method: 'POST',
        });
        spinner.succeed(`${result.message}`);
        if (result.result) {
          writeLine(chalk.gray(JSON.stringify(result.result, null, 2)));
        }
      } catch (err: unknown) {
        spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
