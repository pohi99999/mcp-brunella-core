/**
 * Tool Discovery CLI Commands — brunella tools list|info|chain|metrics
 * Track #6: MCP Tool Discovery — Phase 4
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { logError } from '../utils/logger.js';

export function registerToolDiscoveryCommands(program: Command) {
  const toolDiscovery = program
    .command('tool-discovery')
    .description('MCP Tool Discovery — dinamikus tool kezelés');

  toolDiscovery
    .command('list')
    .description('Összes regisztrált tool listázása')
    .option('-t, --tag <tag>', 'Szűrés tag alapján')
    .option('--deprecated', 'Deprecated tool-ok mutatása')
    .action(async (opts: { tag?: string; deprecated?: boolean }) => {
      try {
        let url = 'http://localhost:3000/api/v1/tools/registry';
        const params: string[] = [];
        if (opts.tag) params.push(`tag=${opts.tag}`);
        if (opts.deprecated) params.push('deprecated=true');
        if (params.length) url += `?${params.join('&')}`;

        const res = await fetch(url);
        const data = await res.json();
        console.log(chalk.bold.cyan('\n🔧 MCP Tool Registry\n'));
        if (!Array.isArray(data) || data.length === 0) {
          console.log(chalk.gray('  Nincs regisztrált tool.'));
          return;
        }
        for (const t of data) {
          const deprecated = t.deprecated ? chalk.yellow(' [DEPRECATED]') : '';
          console.log(`  ${chalk.bold(t.name)} v${t.version}${deprecated}`);
          console.log(`    ${chalk.gray(t.description)}`);
          if (t.tags?.length) console.log(`    Tags: ${t.tags.map((tg: string) => chalk.blue(tg)).join(', ')}`);
          console.log('');
        }
        console.log(chalk.gray(`  Összesen: ${data.length} tool`));
      } catch (e) {
        logError('ToolsCLI', `list hiba: ${e}`);
        console.log(chalk.red(`Hiba: ${e}`));
      }
    });

  toolDiscovery
    .command('metrics')
    .description('Tool metrikák lekérdezése')
    .option('-i, --id <toolId>', 'Specifikus tool ID')
    .action(async (opts: { id?: string }) => {
      try {
        const url = opts.id
          ? `http://localhost:3000/api/v1/tools/metrics/${opts.id}`
          : 'http://localhost:3000/api/v1/tools/stats';
        const res = await fetch(url);
        const data = await res.json();
        console.log(chalk.bold.cyan('\n📊 Tool Metrics\n'));
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(chalk.red(`Hiba: ${e}`));
      }
    });

  toolDiscovery
    .command('chain')
    .description('Tool chain futtatása')
    .argument('<steps...>', 'Tool ID-k sorrendben (pl. parser transformer formatter)')
    .option('-i, --input <json>', 'Kezdő input JSON')
    .action(async (steps: string[], opts: { input?: string }) => {
      try {
        const input = opts.input ? JSON.parse(opts.input) : {};
        const res = await fetch('http://localhost:3000/api/v1/tools/chain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps, input }),
        });
        const data = await res.json();
        if (data.success) {
          console.log(chalk.green(`✅ Chain sikeresen lefutott (${data.completedSteps}/${data.totalSteps})`));
          console.log(chalk.gray(JSON.stringify(data.result, null, 2)));
        } else {
          console.log(chalk.red(`❌ Chain hiba a ${data.failedAtStep ?? '?'}. lépésnél`));
          console.log(chalk.red(data.error));
        }
      } catch (e) {
        console.log(chalk.red(`Hiba: ${e}`));
      }
    });
}
