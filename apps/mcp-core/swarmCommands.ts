/**
 * Swarm CLI Commands
 *
 * Parancsok:
 *  - brunella swarm  # Interaktív raj menü
 */

import { Command } from 'commander';
import { swarmMenu } from './commands/swarm-hu.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { writeLine } from '@packages/utils/cliOutput.js';

/**
 * Register swarm commands
 */
export function registerSwarmCommands(program: Command) {
  const swarm = program
    .command('swarm')
    .description('🐝 Swarm Orchestrator (ClawSwarm) vezérlőpult');

  swarm
    .action(async () => {
      // If no subcommands or arguments were provided, run the interactive menu
      // In commander, if subcommands exist, the parent action runs if no subcommand matches
      // but only if we don't have .passThroughOptions() or similar.
      // Actually, for better control, we can check args.
      if (swarm.args.length === 0) {
        await swarmMenu();
      }
    });

  const SWARM_CLI_HTTP_TIMEOUT_MS = Number(process.env.BRUNELLA_SWARM_CLI_HTTP_TIMEOUT_MS || '4000');

  async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SWARM_CLI_HTTP_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  swarm
    .command('status')
    .description('List all swarm colonies and their status')
    .action(async () => {
      try {
        const res = await fetchWithTimeout('http://localhost:3000/api/v1/swarm/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { colonies?: Array<{ colonyId: string; name: string; status: string; agentCount: number }>; total?: number };
        if (!Array.isArray(data.colonies)) {
          console.error('Unexpected response:', JSON.stringify(data));
          process.exit(1);
        }
        writeLine(`\nSwarm Colonies (${data.total ?? data.colonies.length} total):`);
        for (const c of data.colonies) {
          writeLine(`  [${c.status.toUpperCase()}] ${c.name} (${c.colonyId}) — ${c.agentCount} agents`);
        }
      } catch (error: unknown) {
        const err = ensureError(error);
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  swarm
    .command('dispatch <task>')
    .description('Dispatch a task to the Triad swarm colony')
    .option('-c, --colony <colonyId>', 'Target colony ID', 'triad-default')
    .action(async (task: string, opts: { colony: string }) => {
      try {
        const res = await fetchWithTimeout('http://localhost:3000/api/v1/swarm/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, colonyId: opts.colony }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as { success: boolean; result: unknown };
        writeLine('\nTask dispatched successfully:');
        writeLine(JSON.stringify(data.result, null, 2));
      } catch (error: unknown) {
        const err = ensureError(error);
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}

