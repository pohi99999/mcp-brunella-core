/**
 * Chaos Engine CLI Commands
 *
 * Parancsok:
 *  - brunella chaos  # Interaktív chaos menü
 */

import { Command } from 'commander';
import { chaosMenu } from './commands/chaos-hu.js';

/**
 * Register chaos commands
 */
export function registerChaosCommands(program: Command) {
  program
    .command('chaos')
    .description('☣ Chaos Engine vezérlőpult (instabilitás tesztelés)')
    .action(async () => {
      await chaosMenu();
    });
}
