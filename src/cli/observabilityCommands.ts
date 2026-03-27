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

  obs
    .command('agent-diagnostics <agentName>')
    .description('Agent diagnosztika és legutóbbi feladatok')
    .option('-n, --limit <count>', 'Maximum elemszám', '10')
    .action(async (agentName: string, opts: { limit?: string }) => {
      try {
        const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';
        const ora = (await import('ora')).default;
        const spinner = ora(`Lekérdezem agent: ${agentName}`);
        spinner.start();

        const statusRes = await fetch(`${API_BASE}/api/agents/status`);
        const statusJson = statusRes.ok ? await statusRes.json() : { agents: [] };
        const agents = statusJson.agents || [];
        const agent = agents.find((a: any) => a.name?.toLowerCase() === agentName.toLowerCase());

        const diagRes = await fetch(`${API_BASE}/api/agents/diagnostics`);
        const diags = diagRes.ok ? await diagRes.json() : {};

        const tasksRes = await fetch(`${API_BASE}/api/tasks?limit=${opts.limit || '50'}`);
        const tasksJson = tasksRes.ok ? await tasksRes.json() : { tasks: [] };
        const allTasks = tasksJson.tasks || [];
        const agentTasks = allTasks.filter((t: any) => t.agent && t.agent.toLowerCase() === agentName.toLowerCase()).slice(0, parseInt(opts.limit || '10', 10));

        spinner.succeed('Lekérdezés kész');
        const chalk = (await import('chalk')).default;
        console.log(chalk.bold(`\nAgent diagnostics: ${agentName}\n`));
        if (agent) {
          console.log(chalk.gray(JSON.stringify(agent, null, 2)));
        } else {
          console.log(chalk.yellow('Agent nem található a status listában.'));
        }

        console.log(chalk.bold('\nLegutóbbi feladatok:'));
        if (agentTasks.length === 0) {
          console.log(chalk.gray('  Nincs feladat.'));
        } else {
          for (const t of agentTasks) {
            console.log(chalk.gray(`  #${t.id} [${t.status}] ${t.created_at} ${t.completed_at || ''}`));
            if (t.result) console.log(chalk.dim(`     ${JSON.stringify(typeof t.result === 'string' ? t.result : t.result).slice(0,200)}`));
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('Hiba:', msg);
        process.exit(1);
      }
    });

  obs
    .command('task-logs <taskId>')
    .description('Task részletes naplók és trace megjelenítése')
    .action(async (taskIdStr: string) => {
      try {
        const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';
        const taskId = Number(taskIdStr);
        if (Number.isNaN(taskId)) {
          console.error('Érvénytelen taskId');
          process.exit(1);
        }
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        if (!res.ok) {
          console.error('Task nem található');
          process.exit(1);
        }
        const data = await res.json();
        const task = data.task;
        const chalk = (await import('chalk')).default;
        console.log(chalk.bold(`\nTask #${taskId} — ${task.agent} — ${task.status}\n`));
        if (task.logs && task.logs.length) {
          for (const log of task.logs) {
            const levelColor = log.level === 'error' ? chalk.red : (log.level === 'warn' ? chalk.yellow : chalk.gray);
            console.log(`${chalk.gray(log.timestamp)} ${levelColor(`[${log.level}]`)} ${log.message}`);
          }
        } else {
          console.log(chalk.gray('Nincsenek naplók a taskhoz.'));
        }
        if (task.result) {
          console.log(chalk.bold('\nResult:\n'), JSON.stringify(task.result, null, 2));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('Hiba:', msg);
        process.exit(1);
      }
    });
  }
