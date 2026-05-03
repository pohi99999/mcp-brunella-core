import type { Command } from 'commander';
import { logInfo } from '../utils/logger.js';
import type { PhoenixFlywheelObservabilityResponse } from '../dashboard/lib/apiService.js';

interface AgentStatusEntry {
  name?: string;
  [key: string]: unknown;
}

interface AgentStatusResponse {
  agents?: AgentStatusEntry[];
}

interface TaskLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface TaskDetails {
  agent?: string;
  status?: string;
  logs?: TaskLogEntry[];
  result?: unknown;
}

interface TaskDetailsResponse {
  task: TaskDetails;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

export function registerObservabilityCommands(program: Command): void {
  const obs = program
    .command('observability')
    .alias('obs')
    .description('LLM Observability — hívás statisztikák és monitorozás');

  obs
    .command('status')
    .description('Phoenix / Flywheel observability státusz')
    .option('--hours <count>', 'Időablak órában', '24')
    .option('-j, --json', 'Nyers JSON kimenet')
    .option('--markdown', 'Markdown kimenet')
    .action(async (opts: { hours?: string; json?: boolean; markdown?: boolean }) => {
      try {
        const hours = Math.max(1, parseInt(opts.hours || '24', 10));
        const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';
        const response = await fetch(`${API_BASE}/api/v1/observability/phoenix-flywheel?hours=${hours}`);

        if (!response.ok) {
          throw new Error(`Phoenix/Flywheel observability: HTTP ${response.status}`);
        }

        const data = await response.json() as PhoenixFlywheelObservabilityResponse;
        const snapshot = data.snapshot;

        if (opts.json) {
          writeLine(JSON.stringify(snapshot, null, 2));
          return;
        }

        if (opts.markdown) {
          writeLine(data.markdown || '');
          return;
        }

        const chalk = (await import('chalk')).default;
        const boxen = (await import('boxen')).default;

        const lines = [
          chalk.bold('🧭 Phoenix / Flywheel Observability'),
          '',
          `  Időablak:        ${chalk.cyan(`last ${snapshot.windowHours}h`)}`,
          `  Összes score:    ${snapshot.summary.score >= 85 ? chalk.green(snapshot.summary.score) : snapshot.summary.score >= 65 ? chalk.yellow(snapshot.summary.score) : chalk.red(snapshot.summary.score)}`,
          `  Phoenix score:   ${snapshot.summary.phoenixScore} (${snapshot.summary.phoenixStatus})`,
          `  Flywheel score:  ${snapshot.summary.flywheelScore} (${snapshot.summary.flywheelStatus})`,
          `  Failure signals: ${chalk.red(snapshot.summary.failureSignals)}`,
          `  Recovery signals: ${chalk.green(snapshot.summary.recoverySignals)}`,
          `  Pending approvals:${chalk.yellow(` ${snapshot.summary.pendingFinalApproval}`)}`,
          `  Curated review:  ${chalk.yellow(snapshot.summary.pendingCuratedReview)}`,
          `  Heartbeat:       ${snapshot.phoenix.heartbeat.status}`,
          `  Reflex model:    ${snapshot.flywheel.learningLoop.activeReflexModel ?? 'n/a'}`,
          '',
          chalk.bold('Phoenix jelzések:'),
        ];

        if (snapshot.phoenix.eventBus.recentSignals.length === 0) {
          lines.push(`  ${chalk.gray('Még nincs Phoenix jelzés.')}`);
        } else {
          for (const signal of snapshot.phoenix.eventBus.recentSignals.slice(0, 5)) {
            lines.push(`  ${chalk.gray(signal.timestamp.slice(0, 19))} ${chalk.blue(signal.event)} ${chalk.gray(signal.detail)}`);
          }
        }

        lines.push('', chalk.bold('Ajánlások:'));
        if (snapshot.recommendations.length === 0) {
          lines.push(`  ${chalk.green('Nincs aktív ajánlás.')}`);
        } else {
          for (const recommendation of snapshot.recommendations.slice(0, 5)) {
            lines.push(`  ${chalk.blue(recommendation.title)} ${chalk.gray(`(${recommendation.target}/${recommendation.priority})`)}`);
          }
        }

        lines.push('', chalk.bold('Mitigation trackek:'));
        if (snapshot.mitigationTracks.length === 0) {
          lines.push(`  ${chalk.green('Nincs javasolt mitigation track.')}`);
        } else {
          for (const track of snapshot.mitigationTracks.slice(0, 5)) {
            lines.push(`  ${chalk.magenta(track.title)} ${chalk.gray(`(${track.priority})`)}`);
          }
        }

        const output = boxen(lines.join('\n'), {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'magenta',
        });
        writeLine(output);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(`Hiba: ${msg}`);
        process.exit(1);
      }
    });

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
        writeLine(output);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(`Hiba: ${msg}`);
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
          writeLine(chalk.gray('Még nincsenek naplózott LLM hívások.'));
          return;
        }

        writeLine(chalk.bold('📋 Legutóbbi LLM hívások:\n'));
        writeLine(chalk.gray('  Időpont             Provider     Model              ms     Tokenek  Status'));
        writeLine(chalk.gray('  ' + '─'.repeat(85)));

        for (const c of calls) {
          const status = c.success ? chalk.green('✓') : chalk.red('✗');
          const provider = c.provider.padEnd(12);
          const model = (c.model || 'N/A').padEnd(18).slice(0, 18);
          const duration = String(c.duration_ms).padStart(6);
          const tokens = String(c.total_tokens).padStart(8);
          writeLine(
            `  ${chalk.gray(c.timestamp.slice(0, 19))} ${chalk.blue(provider)} ${model} ${duration} ${tokens}  ${status}`
          );
        }

        writeLine(`\n  Összesen: ${chalk.cyan(calls.length)} hívás`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(`Hiba: ${msg}`);
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
        const statusJson = statusRes.ok ? await statusRes.json() as AgentStatusResponse : { agents: [] };
        const agents = statusJson.agents || [];
        const agent = agents.find((entry) => entry.name?.toLowerCase() === agentName.toLowerCase());

        const diagRes = await fetch(`${API_BASE}/api/agents/diagnostics`);
        const diags = diagRes.ok ? await diagRes.json() : {};

        const tasksRes = await fetch(`${API_BASE}/api/tasks?limit=${opts.limit || '50'}`);
        const tasksJson = tasksRes.ok ? await tasksRes.json() as { tasks?: Array<Record<string, unknown>> } : { tasks: [] };
        const allTasks = tasksJson.tasks || [];
        const agentTasks = allTasks
          .filter((task) => typeof task.agent === 'string' && task.agent.toLowerCase() === agentName.toLowerCase())
          .slice(0, parseInt(opts.limit || '10', 10));

        spinner.succeed('Lekérdezés kész');
        const chalk = (await import('chalk')).default;
        writeLine(chalk.bold(`\nAgent diagnostics: ${agentName}\n`));
        if (agent) {
          writeLine(chalk.gray(JSON.stringify(agent, null, 2)));
        } else {
          writeLine(chalk.yellow('Agent nem található a status listában.'));
        }

        writeLine(chalk.bold('\nLegutóbbi feladatok:'));
        if (agentTasks.length === 0) {
          writeLine(chalk.gray('  Nincs feladat.'));
        } else {
          for (const t of agentTasks) {
            writeLine(chalk.gray(`  #${String(t.id)} [${String(t.status)}] ${String(t.created_at)} ${String(t.completed_at || '')}`));
            if (t.result) {
              writeLine(chalk.dim(`     ${JSON.stringify(typeof t.result === 'string' ? t.result : t.result).slice(0, 200)}`));
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(`Hiba: ${msg}`);
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
          writeError('Érvénytelen taskId');
          process.exit(1);
        }
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        if (!res.ok) {
          writeError('Task nem található');
          process.exit(1);
        }
        const data = await res.json() as TaskDetailsResponse;
        const task = data.task;
        const chalk = (await import('chalk')).default;
        writeLine(chalk.bold(`\nTask #${taskId} — ${task.agent ?? 'unknown'} — ${task.status ?? 'unknown'}\n`));
        if (task.logs && task.logs.length) {
          for (const log of task.logs) {
            const levelColor = log.level === 'error' ? chalk.red : (log.level === 'warn' ? chalk.yellow : chalk.gray);
            writeLine(`${chalk.gray(log.timestamp)} ${levelColor(`[${log.level}]`)} ${log.message}`);
          }
        } else {
          writeLine(chalk.gray('Nincsenek naplók a taskhoz.'));
        }
        if (task.result) {
          writeLine(chalk.bold('\nResult:\n'));
          writeLine(JSON.stringify(task.result, null, 2));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(`Hiba: ${msg}`);
        process.exit(1);
      }
    });
}
