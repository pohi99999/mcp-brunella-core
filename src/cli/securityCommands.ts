/**
 * Security CLI Commands
 *
 * Parancsok:
 *  - brunella security  # Interaktív biztonsági menü
 */

import { Command } from 'commander';
import { securityMenu } from './commands/security-hu.js';

/**
 * Register security commands
 */
export function registerSecurityCommands(program: Command) {
  program
    .command('security')
    .description('🛡️ Security Sandbox vezérlőpult (IPI védelem)')
    .action(async () => {
      await securityMenu();
    });
}
