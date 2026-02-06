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
      console.log(chalk.bold.green('\n✅ Worker Status: ONLINE\n'));
      console.log(chalk.cyan('Service:'), data.service);
      console.log(chalk.cyan('Version:'), data.version);
      console.log(chalk.cyan('Architecture:'), data.architecture);
      console.log(chalk.cyan('Status:'), data.status);

      console.log(chalk.bold('\nAvailable Endpoints:'));
      Object.entries(data.endpoints).forEach(([key, value]) => {
        console.log(chalk.gray(`  ${key}:`), value);
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
      console.log(chalk.bold.green('\n✅ Task Submitted!\n'));
      console.log(chalk.cyan('Task ID:'), data.taskId);
      console.log(chalk.cyan('Type:'), data.type);
      console.log(chalk.cyan('Status:'), data.message);

      console.log(chalk.gray('\nCheck status with:'));
      console.log(chalk.yellow(`  brunella edge status ${data.taskId}`));
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
      console.log(chalk.bold('\n📊 Task Status\n'));
      console.log(chalk.cyan('Task ID:'), data.taskId);
      console.log(chalk.cyan('Type:'), data.type);
      console.log(chalk.cyan('Status:'), data.status);

      if (data.result) {
        console.log(chalk.bold('\nResult:'));
        console.log(JSON.stringify(data.result, null, 2));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch status'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
