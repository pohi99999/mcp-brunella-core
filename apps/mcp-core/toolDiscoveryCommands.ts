/**
 * Tool Discovery CLI Commands — brunella tools list|info|chain|metrics
 * Track #6: MCP Tool Discovery — Phase 4
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { logError } from '@packages/utils/logger.js';
import { type ToolLike } from '@packages/utils/prebuiltTools.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function printToolCatalog(tools: ToolLike[]) {
  if (tools.length === 0) {
    writeLine(chalk.gray('  Nincs regisztrált tool.'));
    return;
  }

  for (const tool of tools) {
    const version = tool.version ? ` v${tool.version}` : '';
    const state = tool.enabled === false ? chalk.yellow(' [DISABLED]') : '';
    const deprecated = tool.deprecated ? chalk.yellow(' [DEPRECATED]') : '';
    const category = tool.category ? chalk.dim(` (${tool.category})`) : '';
    writeLine(`  ${chalk.bold(tool.name)}${version}${deprecated}${state}${category}`);

    if (tool.description) {
      writeLine(`    ${chalk.gray(tool.description)}`);
    }

    const tags = tool.tags ?? [];
    if (tags.length > 0) {
      writeLine(`    ${chalk.dim(`Tags: ${tags.map((tag) => chalk.blue(tag)).join(', ')}`)}`);
    }

    const parameters = tool.parameters ?? [];
    if (parameters.length > 0) {
      const paramText = parameters
        .map((parameter) => `${parameter.name}:${parameter.type}${parameter.required ? '*' : ''}`)
        .join(', ');
      writeLine(`    ${chalk.dim(`Params: ${paramText}`)}`);
    }

    writeLine('');
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

function getToolsApiBaseUrl(): string {
  return (process.env.BRUNELLA_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
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
        let url = `${getToolsApiBaseUrl()}/api/v1/tools/registry`;
        const params: string[] = [];
        if (opts.tag) params.push(`tag=${opts.tag}`);
        if (opts.deprecated) params.push('deprecated=true');
        if (params.length) url += `?${params.join('&')}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data: unknown = await res.json();
        const tools = extractToolArray(data);

        writeLine(chalk.bold.cyan('\n🔧 MCP Tool Registry\n'));
        printToolCatalog(tools);
        writeLine(chalk.gray(`  Összesen: ${tools.length} tool`));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logError('ToolsCLI', `list hiba: ${message}`);
        writeError(chalk.red(`Hiba: ${message}`));
        writeError(chalk.gray('A tool registry jelenleg csak élő szerverválaszból tekinthető hitelesnek.'));
      }
    });

  toolDiscovery
    .command('metrics')
    .description('Tool metrikák lekérdezése')
      .option('-i, --id <toolId>', 'Specifikus tool ID')
    .action(async (opts: { id?: string }) => {
      try {
        const url = opts.id
          ? `${getToolsApiBaseUrl()}/api/v1/tools/metrics/${opts.id}`
          : `${getToolsApiBaseUrl()}/api/v1/tools/stats`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        writeLine(chalk.bold.cyan('\n📊 Tool Metrics\n'));
        writeLine(JSON.stringify(data, null, 2));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        writeError(chalk.red(`Hiba: ${message}`));
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
        const res = await fetch(`${getToolsApiBaseUrl()}/api/v1/tools/chain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps, input }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success) {
          writeLine(chalk.green(`✅ Chain sikeresen lefutott (${data.completedSteps}/${data.totalSteps})`));
          writeLine(chalk.gray(JSON.stringify(data.result, null, 2)));
        } else {
          writeError(chalk.red(`❌ Chain hiba a ${data.failedAtStep ?? '?'}. lépésnél`));
          writeError(chalk.red(data.error));
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        writeError(chalk.red(`Hiba: ${message}`));
      }
    });
}

