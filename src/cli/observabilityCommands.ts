import type { Command } from 'commander';
import { logInfo } from '../utils/logger.js';

export function registerObservabilityCommands(program: Command): void {
  const obs = program
    .command('observability')
    .alias('obs')
    .description('LLM Observability — hívás statisztikák és monitorozás');

  obs
    .command('stats')
    .description('LLM hívás statisztikák megjelenítése')
    .option('-s, --since <date>', 'Időszak kezdete (ISO formátum)')
    .action(async (opts: { since?: string }) => {
      try {
        const { getLlmCallStats } = await import('../utils/globalDb.js');
        const stats = getLlmCallStats(opts.since);

        logInfo('CLI', 'LLM Observability Stats lekérdezve');

        const chalk = (await import('chalk')).default;
        const boxen = (await import('boxen')).default;

        const lines = [
          chalk.bold('📊 LLM Observability Összefoglaló'),
          '',
          `  Összes hívás:    ${chalk.cyan(stats.totalCalls)}`,
          `  Sikerráta:       ${stats.successRate >= 95 ? chalk.green(stats.successRate.toFixed(1) + '%') : chalk.yellow(stats.successRate.toFixed(1) + '%')}`,
          `  Átlag latency:   ${chalk.cyan(stats.avgDurationMs + ' ms')}`,
          `  Összes token:    ${chalk.cyan(stats.totalTokens.toLocaleString())}`,
          `  Költség (USD):   ${chalk.green('$' + stats.totalCostUsd.toFixed(4))}`,
          '',
          chalk.bold('Provider bontás:'),
        ];

        if (stats.byProvider.length > 0) {
          for (const p of stats.byProvider) {
            lines.push(`  ${chalk.blue(p.provider.padEnd(12))} ${String(p.count).padStart(5)} hívás | ${String(Math.round(p.avgDuration)).padStart(5)} ms avg | ${p.tokens.toLocaleString()} token`);
          }
        } else {
          lines.push(`  ${chalk.gray('Még nincs adat')}`);
        }

        if (stats.recentErrors.length > 0) {
          lines.push('', chalk.bold.red('⚠ Legutóbbi hibák:'));
          for (const e of stats.recentErrors.slice(0, 5)) {
            lines.push(`  ${chalk.gray(e.timestamp.slice(0, 19))} [${chalk.yellow(e.provider)}] ${chalk.red(e.error?.slice(0, 80) || 'N/A')}`);
          }
        }

        const output = boxen(lines.join('\n'), {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        });
        process.stdout.write(output + '\n');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Hiba: ${msg}\n`);
        process.exit(1);
      }
    });

  obs
    .command('calls')
    .description('Legutóbbi LLM hívások listázása')
    .option('-n, --limit <count>', 'Maximum elemszám', '20')
    .option('-p, --provider <name>', 'Szűrés provider-re')
    .action(async (opts: { limit?: string; provider?: string }) => {
      try {
        const { queryLlmCalls } = await import('../utils/globalDb.js');
        const calls = queryLlmCalls({
          provider: opts.provider,
          limit: parseInt(opts.limit || '20', 10),
        });

        const chalk = (await import('chalk')).default;

        if (calls.length === 0) {
          process.stdout.write(chalk.gray('Még nincsenek naplózott LLM hívások.\n'));
          return;
        }

        process.stdout.write(chalk.bold('📋 Legutóbbi LLM hívások:\n\n'));
        process.stdout.write(
          chalk.gray('  Időpont             Provider     Model              ms     Tokenek  Status\n')
        );
        process.stdout.write(chalk.gray('  ' + '─'.repeat(85) + '\n'));

        for (const c of calls) {
          const status = c.success ? chalk.green('✓') : chalk.red('✗');
          const provider = c.provider.padEnd(12);
          const model = (c.model || 'N/A').padEnd(18).slice(0, 18);
          const duration = String(c.duration_ms).padStart(6);
          const tokens = String(c.total_tokens).padStart(8);
          process.stdout.write(
            `  ${chalk.gray(c.timestamp.slice(0, 19))} ${chalk.blue(provider)} ${model} ${duration} ${tokens}  ${status}\n`
          );
        }

        process.stdout.write(`\n  Összesen: ${chalk.cyan(calls.length)} hívás\n`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Hiba: ${msg}\n`);
        process.exit(1);
      }
    });
}
