/**
 * Hook CLI Commands — brunella hooks <subcommand>
 *
 * Available sub-commands:
 *   brunella hooks list              — List all registered hooks
 *   brunella hooks log [--event <name>] [--last <n>]
 *   brunella hooks fire <name>       — Fire a hook with empty context
 *   brunella hooks dlq               — Show DLQ entries
 *   brunella hooks dlq retry         — Reset all DLQ entries for immediate retry
 *   brunella hooks dlq clear         — Delete all DLQ entries
 *   brunella hooks circuit-breakers  — Show all circuit breaker states
 *
 * @version 1.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { listHooks, listHookDefinitions, type HookName } from '../utils/hooks.js';
import { getRecentExecutions, getFailureStats } from '../core/hookAuditTrail.js';
import { listDlqEntries, retryAllDlq, clearDlq } from '../core/hookDlq.js';
import { getAllCircuitStates } from '../core/hookCircuitBreaker.js';
import { fireHooks } from '../core/hookEngine.js';
import { logError } from '../utils/logger.js';

// ============================================================================
// OUTPUT HELPERS (never console.log)
// ============================================================================

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

// ============================================================================
// VALID HOOK NAMES (for validation)
// ============================================================================

const VALID_HOOK_NAMES: ReadonlySet<string> = new Set<HookName>([
  'BeforeTool', 'AfterTool', 'BeforeAgent', 'AfterAgent',
  'Notification', 'SessionStart', 'SessionEnd', 'PreCompress',
  'BeforeModel', 'AfterModel', 'BeforeToolSelection',
  'PatternLearned', 'MemoryConsolidation',
]);

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

/**
 * Register all `brunella hooks *` CLI sub-commands onto the program.
 *
 * @param program - Commander root program instance
 */
export function registerHooksCommands(program: Command): void {
  const hooks = program
    .command('hooks')
    .description('Hook pipeline kezelés — lista, napló, DLQ, circuit breakerek');

  // ─── hooks list ───────────────────────────────────────────────────────────
  hooks
    .command('list')
    .description('Regisztrált hook handlerek listázása (részletes nézettel)')
    .option('--summary', 'Összefoglaló nézet handler-számokkal')
    .action((opts: { summary?: boolean }) => {
      try {
        if (opts.summary) {
          const entries = listHooks();
          if (entries.length === 0) {
            writeLine(chalk.yellow('Nincs regisztrált hook.'));
            return;
          }
          writeLine(chalk.bold('\n📋 Regisztrált Hook Összefoglaló:'));
          writeLine(chalk.gray('─'.repeat(40)));
          for (const entry of entries) {
            writeLine(
              `  ${chalk.cyan(entry.name.padEnd(24))} ${chalk.white(entry.count)} handler`
            );
          }
          writeLine('');
        } else {
          const defs = listHookDefinitions();
          if (defs.length === 0) {
            writeLine(chalk.yellow('Nincs regisztrált hook.'));
            return;
          }
          writeLine(chalk.bold('\n📋 Hook Definíciók:'));
          writeLine(chalk.gray('─'.repeat(72)));
          for (const def of defs) {
            const statusIcon = def.enabled ? chalk.green('✓') : chalk.red('✗');
            writeLine(
              `  ${statusIcon} ${chalk.cyan(`${def.name}[${def.index}]`.padEnd(30))} ` +
              `pri=${chalk.yellow(String(def.priority))} ` +
              `timeout=${chalk.gray(`${def.timeout}ms`)} ` +
              `cat=${chalk.magenta(def.category)}` +
              (def.description ? `\n     ${chalk.gray(def.description)}` : '')
            );
          }
          writeLine('');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks list failed: ${msg}`);
      }
    });

  // ─── hooks log ────────────────────────────────────────────────────────────
  hooks
    .command('log')
    .description('Hook végrehajtási napló megjelenítése')
    .option('--event <name>', 'Szűrés hook névre')
    .option('--last <n>', 'Utolsó N bejegyzés', '20')
    .action((opts: { event?: string; last?: string }) => {
      try {
        const limit = parseInt(opts.last ?? '20', 10);
        const entries = getRecentExecutions({ event: opts.event, limit });
        const stats = getFailureStats();

        if (entries.length === 0) {
          writeLine(chalk.yellow('Nincs végrehajtási napló.'));
          return;
        }

        writeLine(chalk.bold(`\n📜 Hook Napló (utolsó ${entries.length}):`));
        writeLine(chalk.gray('─'.repeat(72)));
        for (const entry of entries) {
          const statusColor =
            entry.status === 'fired'
              ? chalk.green
              : entry.status === 'skipped'
              ? chalk.gray
              : chalk.red;

          writeLine(
            `  [${chalk.gray(entry.timestamp ?? '')}] ` +
            `${chalk.cyan(entry.event.padEnd(22))} ` +
            `${statusColor(entry.status.padEnd(8))} ` +
            `${chalk.gray(`${entry.durationMs}ms`)}` +
            (entry.error ? chalk.red(` | ${entry.error.slice(0, 60)}`) : '')
          );
        }

        if (stats.length > 0) {
          writeLine('');
          writeLine(chalk.bold('⚠️  Hibák összesítve:'));
          for (const stat of stats) {
            writeLine(
              `  ${chalk.cyan(stat.event.padEnd(22))} ` +
              `${chalk.red(stat.status.padEnd(8))} ` +
              `${chalk.yellow(String(stat.count))} alkalom`
            );
          }
        }
        writeLine('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks log failed: ${msg}`);
      }
    });

  // ─── hooks fire ───────────────────────────────────────────────────────────
  hooks
    .command('fire <name>')
    .description('Hook manuális aktiválása üres kontextussal')
    .action(async (name: string) => {
      if (!VALID_HOOK_NAMES.has(name)) {
        writeError(chalk.red(`Ismeretlen hook neve: "${name}"`));
        writeError(chalk.gray(`Érvényes nevek: ${[...VALID_HOOK_NAMES].join(', ')}`));
        return;
      }
      try {
        writeLine(chalk.yellow(`⚡ Hook aktiválása: ${name}`));
        await fireHooks(name as HookName, { source: 'cli' }, { skipAudit: false });
        writeLine(chalk.green('✓ Hook sikeresen aktiválva.'));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks fire failed: ${msg}`);
      }
    });

  // ─── hooks dlq ────────────────────────────────────────────────────────────
  const dlq = hooks
    .command('dlq')
    .description('Dead Letter Queue (DLQ) kezelése')
    .action(() => {
      try {
        const entries = listDlqEntries();
        if (entries.length === 0) {
          writeLine(chalk.green('✓ A DLQ üres.'));
          return;
        }
        writeLine(chalk.bold(`\n💀 DLQ Bejegyzések (${entries.length} db):`));
        writeLine(chalk.gray('─'.repeat(72)));
        const now = Date.now();
        for (const entry of entries) {
          const retryIn = Math.max(0, Math.round((entry.nextRetryAt - now) / 1000));
          writeLine(
            `  [${chalk.gray(String(entry.id))}] ` +
            `${chalk.cyan(entry.event.padEnd(22))} ` +
            `${chalk.yellow(`${entry.attempts} kísérlet`).padEnd(14)} ` +
            `${chalk.gray(`retry: ${retryIn}s`)} ` +
            chalk.red(`| ${entry.reason.slice(0, 50)}`)
          );
        }
        writeLine('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks dlq failed: ${msg}`);
      }
    });

  dlq
    .command('retry')
    .description('Összes DLQ bejegyzés azonnali újra-feldolgozásra jelölése')
    .action(() => {
      try {
        retryAllDlq();
        writeLine(chalk.green('✓ Összes DLQ bejegyzés újra-feldolgozásra jelölve.'));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks dlq retry failed: ${msg}`);
      }
    });

  dlq
    .command('clear')
    .description('Összes DLQ bejegyzés törlése')
    .action(() => {
      try {
        clearDlq();
        writeLine(chalk.green('✓ DLQ törölve.'));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks dlq clear failed: ${msg}`);
      }
    });

  // ─── hooks circuit-breakers ───────────────────────────────────────────────
  hooks
    .command('circuit-breakers')
    .alias('cb')
    .description('Circuit breaker állapotok megjelenítése')
    .action(() => {
      try {
        const states = getAllCircuitStates();
        if (states.length === 0) {
          writeLine(chalk.gray('Nincs aktív circuit breaker.'));
          return;
        }
        writeLine(chalk.bold('\n⚡ Circuit Breaker Állapotok:'));
        writeLine(chalk.gray('─'.repeat(60)));
        for (const cb of states) {
          const stateColor =
            cb.state === 'closed'
              ? chalk.green
              : cb.state === 'half-open'
              ? chalk.yellow
              : chalk.red;
          writeLine(
            `  ${stateColor(cb.state.toUpperCase().padEnd(10))} ` +
            `${chalk.cyan(cb.key.padEnd(28))} ` +
            `hibák=${chalk.yellow(String(cb.failures))}`
          );
        }
        writeLine('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`Hiba: ${msg}`));
        logError('HookCommands', `hooks circuit-breakers failed: ${msg}`);
      }
    });
}
