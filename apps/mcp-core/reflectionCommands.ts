import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { writeLine } from '@packages/utils/cliOutput.js';

import type { ReflectionOverview } from '@packages/core-logic/reflectionOverview.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/reflection${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json() as { ok?: boolean; overview?: T; result?: T; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return (payload.overview ?? payload.result) as T;
}

function printOverview(overview: ReflectionOverview): void {
  writeLine(boxen(chalk.cyan('Reflection állapot'), { padding: 1, borderStyle: 'round' }));
  writeLine(`Reflections: ${chalk.white(String(overview.stats.totalReflections))}`);
  writeLine(`Avg quality: ${chalk.white(`${Math.round(overview.stats.avgQualityScore * 100)}%`)}`);
  writeLine(`Self-model:  ${chalk.white(overview.selfModel.health)}`);
  writeLine(`Pain points: ${chalk.white(String(overview.painPoints.length))}`);

  writeLine(chalk.bold('\nMemória boundary'));
  writeLine(`  Globális: ${overview.selfModel.memoryScopes.global.purpose}`);
  writeLine(`  Lokális : ${overview.selfModel.memoryScopes.local.purpose}`);

  if (overview.painPoints.length > 0) {
    writeLine(chalk.bold('\nPain points'));
    for (const point of overview.painPoints.slice(0, 5)) {
      writeLine(`  • ${point.agent} [${point.severity}] ${point.failureCount} hiba — ${point.recommendation}`);
    }
  }

  if (overview.insights.length > 0) {
    writeLine(chalk.bold('\nMeta insightok'));
    for (const insight of overview.insights.slice(0, 5)) {
      writeLine(`  • [${insight.category}] ${insight.description}`);
    }
  }

  writeLine(chalk.bold('\nContext'));
  writeLine(chalk.dim(overview.context || 'Nincs reflection context.'));
}

export function registerReflectionCommands(program: Command): void {
  const reflection = program
    .command('reflection')
    .description('Reflection / continual learning operator feluletek');

  reflection
    .command('status')
    .description('Reflection allapot megjelenitese')
    .action(async () => {
      const spinner = ora('Reflection allapot betoltese...').start();
      try {
        const overview = await apiFetch<ReflectionOverview>('/overview');
        spinner.stop();
        printOverview(overview);
      } catch (error: unknown) {
        spinner.fail(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  reflection
    .command('cycle')
    .description('Nightly reflection cycle manualis futtatasa')
    .action(async () => {
      const spinner = ora('Reflection nightly cycle futtatasa...').start();
      try {
        await apiFetch<Record<string, unknown>>('/nightly-cycle', { method: 'POST' });
        spinner.succeed('Reflection nightly cycle lefutott.');
      } catch (error: unknown) {
        spinner.fail(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

