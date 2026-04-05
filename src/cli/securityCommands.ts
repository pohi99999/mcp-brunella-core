/**
 * Security CLI Commands — Track #7 Sandbox & Security
 *
 * Commands:
 * - brunella security audit       — Full RBAC audit report
 * - brunella security permissions — Show agent permissions
 * - brunella security sandbox     — Sandbox execution statistics
 * - brunella security violations  — Recent security violations
 *
 * @track sandbox_security_hardening_20260323
 * @phase Phase 4: CLI Integration
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { writeLine } from '../utils/cliOutput.js';

export function registerSecurityCommands(program: Command): void {
  const secCmd = program
    .command('security')
    .description('🔒 Security & Sandbox management');

  // --- audit ---
  secCmd
    .command('audit')
    .description('Full RBAC audit report')
    .action(async () => {
      try {
        const { getEnhancedPermissionManager } = await import('../core/rbac/agentPermissions.js');
        const pm = getEnhancedPermissionManager();

        writeLine(chalk.bold.cyan('\n🛡️  RBAC Audit Report\n'));

        const profiles = pm.listProfiles();
        writeLine(chalk.bold('Profilok:'));
        for (const p of profiles) {
          const tools = p.toolCount === -1 ? chalk.red('* (minden)') : chalk.yellow(String(p.toolCount));
          const net = p.networkDomains === -1 ? chalk.red('* (minden)') : chalk.yellow(String(p.networkDomains));
          writeLine(`  ${chalk.green(p.name.padEnd(14))} role=${p.role.padEnd(12)} tools=${tools.padStart(8)} domains=${net}`);
        }

        const vStats = pm.getViolationStats();
        writeLine(chalk.bold('\nSértés statisztika:'));
        writeLine(`  Összesen: ${chalk.yellow(String(vStats.total))}`);
        writeLine(`  Kritikus: ${chalk.red(String(vStats.bySeverity.critical))}  Magas: ${chalk.red(String(vStats.bySeverity.high))}  Közepes: ${chalk.yellow(String(vStats.bySeverity.medium))}  Alacsony: ${chalk.blue(String(vStats.bySeverity.low))}`);

        if (vStats.alertThresholdReached) {
          writeLine(chalk.bgRed.white('\n  🚨 FIGYELEM: Alert küszöb elérve!'));
        } else {
          writeLine(chalk.green('\n  ✅ Nincs aktív alert'));
        }

        writeLine('');
      } catch (err: unknown) {
        console.error(chalk.red('Hiba:'), (err as Error).message);
        process.exit(1);
      }
    });

  // --- permissions ---
  secCmd
    .command('permissions [agent]')
    .description('Show agent permission profile')
    .action(async (agentName?: string) => {
      try {
        const { getEnhancedPermissionManager } = await import('../core/rbac/agentPermissions.js');
        const pm = getEnhancedPermissionManager();

        if (!agentName) {
          writeLine(chalk.bold.cyan('\n🔐 Registered Permission Profiles\n'));
          const profiles = pm.listProfiles();
          for (const p of profiles) {
            writeLine(`  ${chalk.green(p.name)} — ${p.role}`);
          }
          writeLine(chalk.dim('\nHasználat: brunella security permissions <agent_name>'));
          return;
        }

        const profile = pm.getAgentProfile(agentName);
        if (!profile) {
          writeLine(chalk.yellow(`Agent "${agentName}" → READONLY (alapértelmezett)`));
          return;
        }

        writeLine(chalk.bold.cyan(`\n🔐 ${agentName} — Profil: ${profile.role}\n`));
        writeLine(`  Jogosultságok: ${profile.permissions.join(', ')}`);
        writeLine(`  Eszközök: ${profile.allowedTools.join(', ')}`);
        writeLine(`  Hálózat: ${profile.allowedNetworkDomains.join(', ') || 'nincs'}`);
        writeLine(`  Kód futtatás: ${profile.codeExecAllowed ? chalk.green('igen') : chalk.red('nem')}`);
        writeLine(`  Max token/hívás: ${profile.resourceLimits.maxTokensPerCall}`);
        writeLine(`  Max költség/nap: $${profile.resourceLimits.maxCostPerDay}`);
        writeLine('');
      } catch (err: unknown) {
        console.error(chalk.red('Hiba:'), (err as Error).message);
        process.exit(1);
      }
    });

  // --- sandbox ---
  secCmd
    .command('sandbox')
    .description('Sandbox execution statistics')
    .action(async () => {
      try {
        const { getSandboxPool } = await import('../core/sandbox/wasmSandbox.js');
        const pool = getSandboxPool();
        const stats = pool.getStats();

        writeLine(chalk.bold.cyan('\n🏖️  Sandbox Statistics\n'));
        writeLine(`  Futtatások:   ${chalk.bold(String(stats.totalExecutions))}`);
        writeLine(`  Sikeres:      ${chalk.green(String(stats.successfulExecutions))}`);
        writeLine(`  Timeout:      ${chalk.yellow(String(stats.timeouts))}`);
        writeLine(`  OOM:          ${chalk.red(String(stats.oomErrors))}`);
        writeLine(`  Bizt. sértés: ${chalk.red(String(stats.securityViolations))}`);
        writeLine(`  Átl. idő:     ${stats.avgDurationMs}ms`);
        writeLine(`  Pool:         ${stats.idleInstances} idle / ${stats.poolSize} total`);
        writeLine('');
      } catch (err: unknown) {
        console.error(chalk.red('Hiba:'), (err as Error).message);
        process.exit(1);
      }
    });

  // --- violations ---
  secCmd
    .command('violations')
    .description('Recent security violations')
    .option('-n, --limit <num>', 'Number of violations to show', '20')
    .action(async (opts: { limit: string }) => {
      try {
        const { getEnhancedPermissionManager } = await import('../core/rbac/agentPermissions.js');
        const pm = getEnhancedPermissionManager();
        const violations = pm.getViolations(parseInt(opts.limit, 10));

        writeLine(chalk.bold.cyan(`\n⚠️  Utolsó ${violations.length} sértés\n`));

        if (violations.length === 0) {
          writeLine(chalk.green('  ✅ Nincs sértés — rendszer tiszta'));
        } else {
          for (const v of violations.slice().reverse()) {
            const sevColor = v.severity === 'critical' ? chalk.bgRed.white :
              v.severity === 'high' ? chalk.red :
                v.severity === 'medium' ? chalk.yellow : chalk.blue;
            const time = new Date(v.timestamp).toLocaleTimeString('hu-HU');
            writeLine(`  ${chalk.dim(time)} ${sevColor(v.severity.padEnd(8))} ${chalk.bold(v.agent.padEnd(20))} ${v.action} ${chalk.dim(v.reason)}`);
          }
        }

        writeLine('');
      } catch (err: unknown) {
        console.error(chalk.red('Hiba:'), (err as Error).message);
        process.exit(1);
      }
    });
}
