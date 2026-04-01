/**
 * Swarm CLI Commands — brunella swarm create|status|scale|destroy|checkpoint
 * Track #5: Swarm Intelligence v2 — Phase 4
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { logInfo, logError } from '../utils/logger.js';

interface SwarmColonyMetrics {
  tasksCompleted?: number;
  tasksFailed?: number;
}

interface SwarmColonyStatus {
  colonyId: string;
  name: string;
  status: string;
  agentCount: number;
  leaderId?: string;
  metrics?: SwarmColonyMetrics;
}

interface SwarmStatusResponse {
  colonies: SwarmColonyStatus[];
  total: number;
}

interface SwarmDispatchResponse {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

export function registerSwarmCommands(program: Command) {
  const swarmV2 = program
    .command('swarm-v2')
    .description('Swarm Intelligence v2 — colony kezelés');

  swarmV2
    .command('status')
    .description('Összes aktív colony állapotának lekérdezése')
    .action(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/swarm/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as SwarmStatusResponse;
        writeLine(chalk.bold.cyan('\n🐝 Swarm Colony Status\n'));
        if (!data.colonies || data.colonies.length === 0) {
          writeLine(chalk.gray('  Nincs aktív colony.'));
          return;
        }
        for (const c of data.colonies) {
          const statusColor = c.status === 'active' ? chalk.green : c.status === 'paused' ? chalk.yellow : chalk.gray;
          writeLine(`  ${chalk.bold(c.name)} [${statusColor(c.status)}]`);
          writeLine(`    Agents: ${c.agentCount} | Leader: ${c.leaderId || '—'}`);
          writeLine(`    Tasks: ${c.metrics?.tasksCompleted ?? 0}✓ / ${c.metrics?.tasksFailed ?? 0}✗`);
          writeLine('');
        }
      } catch (e: unknown) {
        logError('SwarmCLI', `status hiba: ${e}`);
        writeError(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
      }
    });

  swarmV2
    .command('dispatch')
    .description('Feladat küldése a swarm-nak')
    .argument('<task>', 'Feladat leírása')
    .option('-c, --colony <id>', 'Colony ID (alapértelmezett: triad-default)')
    .action(async (task: string, opts: { colony?: string }) => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/swarm/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, colonyId: opts.colony }),
        });
        const data = await res.json() as SwarmDispatchResponse;
        if (data.success) {
          writeLine(chalk.green('✅ Feladat sikeresen elküldve'));
          writeLine(chalk.gray(JSON.stringify(data.result ?? {}, null, 2)));
        } else {
          writeError(chalk.red(`❌ Hiba: ${data.error ?? 'Ismeretlen hiba'}`));
        }
      } catch (e: unknown) {
        logError('SwarmCLI', `dispatch hiba: ${e}`);
        writeError(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
      }
    });

  swarmV2
    .command('checkpoints')
    .description('Colony checkpoint-ok listázása')
    .option('-s, --swarm <id>', 'Colony ID szűrő')
    .action(async (opts: { swarm?: string }) => {
      try {
        const url = opts.swarm
          ? `http://localhost:3000/api/v1/swarm/checkpoints?swarmId=${opts.swarm}`
          : 'http://localhost:3000/api/v1/swarm/checkpoints/stats';
        const res = await fetch(url);
        const data = await res.json();
        writeLine(chalk.bold.cyan('\n📸 Swarm Checkpoints\n'));
        writeLine(JSON.stringify(data, null, 2));
      } catch (e: unknown) {
        writeError(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
      }
    });
}
