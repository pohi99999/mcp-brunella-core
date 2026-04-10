/**
 * Swarm CLI Commands
 *
 * Parancsok:
 *  - brunella swarm  # Interaktív raj menü
 */

import { Command } from 'commander';
import { swarmMenu } from './commands/swarm-hu.js';

/**
 * Register swarm commands
 */
export function registerSwarmCommands(program: Command) {
  program
    .command('swarm')
    .description('🐝 Swarm Orchestrator (ClawSwarm) vezérlőpult')
    .action(async () => {
      await swarmMenu();
    });
}
