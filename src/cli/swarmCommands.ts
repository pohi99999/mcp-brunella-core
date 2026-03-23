/**
 * Swarm CLI Commands — brunella swarm create|status|scale|destroy|checkpoint
 * Track #5: Swarm Intelligence v2 — Phase 4
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { logInfo, logError } from '../utils/logger.js';

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
        const data = await res.json();
        console.log(chalk.bold.cyan('\n🐝 Swarm Colony Status\n'));
        if (!data.colonies || data.colonies.length === 0) {
          console.log(chalk.gray('  Nincs aktív colony.'));
          return;
        }
        for (const c of data.colonies) {
          const statusColor = c.status === 'active' ? chalk.green : c.status === 'paused' ? chalk.yellow : chalk.gray;
          console.log(`  ${chalk.bold(c.name)} [${statusColor(c.status)}]`);
          console.log(`    Agents: ${c.agentCount} | Leader: ${c.leaderId || '—'}`);
          console.log(`    Tasks: ${c.metrics?.tasksCompleted ?? 0}✓ / ${c.metrics?.tasksFailed ?? 0}✗`);
          console.log('');
        }
      } catch (e) {
        logError('SwarmCLI', `status hiba: ${e}`);
        console.log(chalk.red(`Hiba: ${e}`));
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
        const data = await res.json();
        if (data.success) {
          console.log(chalk.green('✅ Feladat sikeresen elküldve'));
          console.log(chalk.gray(JSON.stringify(data.result, null, 2)));
        } else {
          console.log(chalk.red(`❌ Hiba: ${data.error}`));
        }
      } catch (e) {
        logError('SwarmCLI', `dispatch hiba: ${e}`);
        console.log(chalk.red(`Hiba: ${e}`));
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
        console.log(chalk.bold.cyan('\n📸 Swarm Checkpoints\n'));
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(chalk.red(`Hiba: ${e}`));
      }
    });
}
