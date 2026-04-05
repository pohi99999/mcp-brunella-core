#!/usr/bin/env node
/**
 * Brunella Edge CLI - Cloudflare Worker Integration
 *
 * Használat:
 *   brunella edge submit "Generate code for user auth"
 *   brunella edge status <taskId>
 *   brunella edge health
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeLine } from './utils/cliOutput.js';

const program = new Command();

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://bas-orchestrator.iam-dd1.workers.dev';

program
  .name('brunella-edge')
  .description('Cloudflare Worker Edge Integration CLI')
  .version('1.0.0');

// Health Check
program
  .command('health')
  .description('Check Cloudflare Worker health')
  .action(async () => {
    const spinner = ora('Checking worker health...').start();

    try {
      const response = await fetch(WORKER_URL);
      const data = await response.json();

      spinner.stop();
      writeLine(chalk.bold.green('\n✅ Worker Status: ONLINE\n'));
      writeLine(chalk.cyan('Service:'), data.service);
      writeLine(chalk.cyan('Version:'), data.version);
      writeLine(chalk.cyan('Architecture:'), data.architecture);
      writeLine(chalk.cyan('Status:'), data.status);

      writeLine(chalk.bold('\nAvailable Endpoints:'));
      Object.entries(data.endpoints).forEach(([key, value]) => {
        writeLine(chalk.gray(`  ${key}:`), value);
      });
    } catch (error: any) {
      spinner.fail(chalk.red('Worker offline or unreachable'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Submit Task
program
  .command('submit <instruction>')
  .description('Submit a task to Cloudflare Worker (AI auto-routing)')
  .option('--context <json>', 'Context as JSON string')
  .action(async (instruction: string, options: { context?: string }) => {
    const spinner = ora('Submitting task to edge...').start();

    try {
      const payload: any = {
        instruction,
        context: options.context ? JSON.parse(options.context) : {}
      };

      const response = await fetch(`${WORKER_URL}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      spinner.stop();
      writeLine(chalk.bold.green('\n✅ Task Submitted!\n'));
      writeLine(chalk.cyan('Task ID:'), data.taskId);
      writeLine(chalk.cyan('Type:'), data.type);
      writeLine(chalk.cyan('Status:'), data.message);

      writeLine(chalk.gray('\nCheck status with:'));
      writeLine(chalk.yellow(`  brunella edge status ${data.taskId}`));
    } catch (error: any) {
      spinner.fail(chalk.red('Task submission failed'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Get Task Status
program
  .command('status <taskId>')
  .description('Get task status from Cloudflare KV')
  .action(async (taskId: string) => {
    const spinner = ora('Fetching task status...').start();

    try {
      const response = await fetch(`${WORKER_URL}/status/${taskId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      spinner.stop();
      writeLine(chalk.bold('\n📊 Task Status\n'));
      writeLine(chalk.cyan('Task ID:'), data.taskId);
      writeLine(chalk.cyan('Type:'), data.type);
      writeLine(chalk.cyan('Status:'), data.status);

      if (data.result) {
        writeLine(chalk.bold('\nResult:'));
        writeLine(JSON.stringify(data.result, null, 2));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch status'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
