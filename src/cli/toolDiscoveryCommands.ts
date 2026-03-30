/**
 * Tool Discovery CLI Commands — brunella tools list|info|chain|metrics
 * Track #6: MCP Tool Discovery — Phase 4
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { logError } from '../utils/logger.js';
import { getPrebuiltToolCatalog, mergeToolLists, type ToolLike } from '../utils/prebuiltTools.js';

function printToolCatalog(tools: ToolLike[]) {
  if (tools.length === 0) {
    console.log(chalk.gray('  Nincs regisztrált tool.'));
    return;
  }

  for (const tool of tools) {
    const version = tool.version ? ` v${tool.version}` : '';
    const state = tool.enabled === false ? chalk.yellow(' [DISABLED]') : '';
    const deprecated = tool.deprecated ? chalk.yellow(' [DEPRECATED]') : '';
    const category = tool.category ? chalk.dim(` (${tool.category})`) : '';
    console.log(`  ${chalk.bold(tool.name)}${version}${deprecated}${state}${category}`);

    if (tool.description) {
      console.log(`    ${chalk.gray(tool.description)}`);
    }

    const tags = tool.tags ?? [];
    if (tags.length > 0) {
      console.log(`    ${chalk.dim(`Tags: ${tags.map((tag) => chalk.blue(tag)).join(', ')}`)}`);
    }

    const parameters = tool.parameters ?? [];
    if (parameters.length > 0) {
      const paramText = parameters
        .map((parameter) => `${parameter.name}:${parameter.type}${parameter.required ? '*' : ''}`)
        .join(', ');
      console.log(`    ${chalk.dim(`Params: ${paramText}`)}`);
    }

    console.log('');
  }
}

function extractToolArray(value: unknown): ToolLike[] {
  if (Array.isArray(value)) {
    return value as ToolLike[];
  }

  if (value && typeof value === 'object') {
    const maybeTools = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybeTools)) {
      return maybeTools as ToolLike[];
    }
  }

  return [];
}

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
        const data: unknown = await res.json();
        const serverTools = extractToolArray(data);
        const localTools = getPrebuiltToolCatalog();
        const tools = mergeToolLists(serverTools, localTools);

        console.log(chalk.bold.cyan('\n🔧 MCP Tool Registry\n'));
        printToolCatalog(tools);
        console.log(chalk.gray(`  Összesen: ${tools.length} tool`));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        const fallbackTools = getPrebuiltToolCatalog();
        logError('ToolsCLI', `list hiba: ${message}`);
        console.log(chalk.bold.cyan('\n🔧 MCP Tool Registry (local fallback)\n'));
        printToolCatalog(fallbackTools);
        console.log(chalk.gray(`  Összesen: ${fallbackTools.length} tool`));
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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(chalk.red(`Hiba: ${message}`));
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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(chalk.red(`Hiba: ${message}`));
      }
    });
}
