import type { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';

import { createTenant, getTenantStatus, listTenants } from '../core/tenantRegistry.js';
import { ensureError } from '../utils/ensureError.js';
import { logError, logInfo } from '../utils/logger.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function printJson(title: string, payload: unknown): void {
  writeLine();
  writeLine(chalk.bold(title));
  writeLine(JSON.stringify(payload, null, 2));
}

export function registerTenantCommands(program: Command): void {
  const tenant = program.command('tenant').description('Tenant management for the L5 multi-tenant platform');

  tenant
    .command('list')
    .description('Lists the registered tenants')
    .action(async () => {
      try {
        logInfo('CLI', 'Tenant lista lekérdezése');
        const tenants = await listTenants();
        printJson('Tenant list', { count: tenants.length, tenants });
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logError('CLI', `Tenant list failed: ${normalized.message}`);
        process.exitCode = 1;
      }
    });

  tenant
    .command('create')
    .description('Creates a tenant and initializes the tenant storage root')
    .requiredOption('--name <name>', 'Tenant display name')
    .option('--id <id>', 'Custom tenant identifier')
    .option('--domain <domain>', 'Primary tenant domain')
    .option('--tier <tier>', 'free | basic | premium | enterprise')
    .option('--status <status>', 'active | suspended | deleted')
    .action(async (options: { name: string; id?: string; domain?: string; tier?: 'free' | 'basic' | 'premium' | 'enterprise'; status?: 'active' | 'suspended' | 'deleted' }) => {
      try {
        logInfo('CLI', `Tenant létrehozása: ${options.name}`);
        const tenantRecord = await createTenant({
          id: options.id,
          name: options.name,
          domain: options.domain,
          tier: options.tier,
          status: options.status,
        });

        writeLine(boxen(chalk.green('Tenant created'), { padding: 1, borderStyle: 'round', borderColor: 'green' }));
        printJson('Tenant record', tenantRecord);
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logError('CLI', `Tenant create failed: ${normalized.message}`);
        process.exitCode = 1;
      }
    });

  tenant
    .command('status <tenantId>')
    .description('Shows tenant status and isolation footprint')
    .action(async (tenantId: string) => {
      try {
        logInfo('CLI', `Tenant státusz lekérdezése: ${tenantId}`);
        const status = await getTenantStatus(tenantId);
        writeLine(boxen(chalk.cyan('Tenant status'), { padding: 1, borderStyle: 'round', borderColor: 'cyan' }));
        printJson('Tenant status', status);
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logError('CLI', `Tenant status failed: ${normalized.message}`);
        process.exitCode = 1;
      }
    });
}
