#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configManager } from './utils/cliConfig';
import { BrunellaClient } from './utils/mcpClient';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import inquirer from 'inquirer';
import ora from 'ora';
import { initTelemetryFromConfig, recordSessionStart, flushTelemetry, recordToolCall, isTelemetryEnabled } from './utils/telemetry';
import { getMemory } from './utils/memoryContext';
import { discoverSkills } from './utils/skillsLoader';
import { listHooks } from './utils/hooks';

const program = new Command();

// Try to read package.json version
let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  version = pkg.version;
} catch (e) {
  // ignore
}

const rawArgs = process.argv.slice(2);
const showBanner =
  !rawArgs.some((a) => a === '--version' || a === '-V' || a === '--help' || a === '-h') &&
  !(configManager.get('ui.hideBanner') as boolean);
if (showBanner) {
  console.log(boxen(chalk.blue('Brunella CLI') + ` v${version}`, { padding: 1, borderStyle: 'round' }));
}

// Telemetry from config (nested settings.telemetry)
try {
  const all = configManager.getAll() as { telemetry?: { enabled?: boolean; target?: string }; serverUrl?: string };
  initTelemetryFromConfig(all);
  if (all?.telemetry?.enabled) {
    recordSessionStart({ cli_version: version, server_url: String(all.serverUrl ?? configManager.get('serverUrl') ?? '') });
  }
} catch (_) {}
process.on('beforeExit', () => { flushTelemetry(); });

program
  .name('brunella')
  .description('Official CLI for Brunella Core')
  .version(version)
  .option('--approval-mode <mode>', 'Approval mode: default | auto_edit | plan | yolo', 'default')
  .option('-s, --sandbox', 'Enable sandbox mode (see tools.sandbox / BRUNELLA_SANDBOX)');

// --- about (Gemini parity)
program.command('about').description('Show version and runtime info').action(() => {
  console.log(chalk.bold('Brunella CLI'));
  console.log('  Version:', version);
  console.log('  Config:  ', configManager.userSettingsPath);
  if (configManager.projectSettingsPath) console.log('  Project: ', configManager.projectSettingsPath);
});

// --- auth (Gemini parity: API key, OAuth/CLI auth)
const authCmd = program.command('auth').description('Manage authentication');
authCmd.command('login').description('Log in or change auth method').option('--api-key <key>', 'Set API key').action((cmd?: { opts: () => { apiKey?: string } }) => {
  const opts = cmd?.opts?.() ?? {};
  if (opts.apiKey) {
    configManager.set('apiKey', opts.apiKey);
    configManager.set('security.auth.selectedType', 'api_key');
    console.log(chalk.green('API key saved.'));
    return;
  }
  console.log(chalk.dim('Auth: use --api-key <key> or set BRUNELLA_API_KEY. For OAuth, use backend login.'));
});
authCmd.command('logout').description('Clear cached credentials').action(() => {
  configManager.set('apiKey', undefined);
  configManager.set('security.auth.selectedType', undefined);
  console.log(chalk.green('Credentials cleared.'));
});

// --- bug (stub)
program.command('bug').description('Submit a bug report').action(() => {
  console.log(chalk.dim('Bug reports: open an issue at the project repository or use /bug in the dashboard.'));
});

// --- config / settings (Gemini parity: settings = config)
const configCommand = program.command('config').description('Manage CLI configuration');

configCommand.command('list').description('List all configuration settings').action(() => {
  const settings = configManager.getAll();
  const flat: Record<string, string> = {};
  function flatten(obj: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key);
      else flat[key] = v === undefined ? '' : Array.isArray(v) ? JSON.stringify(v) : String(v);
    }
  }
  flatten(settings as unknown as Record<string, unknown>, '');
  console.log(chalk.bold('Current Configuration:'));
  for (const [key, value] of Object.entries(flat)) console.log(`  ${chalk.cyan(key)}: ${value}`);
});

configCommand.command('get <key>').description('Get a specific configuration setting').action((key: string) => {
  const v = configManager.get(key);
  if (v !== undefined) console.log(`${key}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  else console.log(chalk.red(`Key '${key}' not found.`));
});

configCommand.command('set <key> <value>').description('Set a configuration setting').action((key: string, value: string) => {
  configManager.set(key, value);
  console.log(chalk.green(`Updated ${key} to ${value}`));
});

program.command('settings').description('View and edit Brunella CLI settings (alias: use config list/get/set)').action(() => {
  console.log(chalk.dim('Use: brunella config list | config get <key> | config set <key> <value>'));
});

// --- clear (stub: clear screen only)
program.command('clear').description('Clear the screen').action(() => {
  console.clear();
});

// --- compress (stub)
program.command('compress').description('Compress context by replacing with a summary').action(() => {
  console.log(chalk.dim('Context compression: not implemented in this mode.'));
});

// --- copy (stub)
program.command('copy').description('Copy last result or code snippet to clipboard').action(() => {
  console.log(chalk.dim('Copy: not implemented; use terminal selection.'));
});

// --- docs
program.command('docs').description('Open Brunella CLI documentation in browser').action(() => {
  const url = 'https://github.com/google-gemini/gemini-cli#readme';
  console.log(chalk.cyan('Docs (Gemini CLI reference):'), url);
});

// --- directory
const dirCmd = program.command('directory').description('Manage workspace directories');
dirCmd.command('add <paths>').description('Add directories (comma-separated)').action((paths: string) => {
  const dirs = paths.split(',').map((p) => p.trim()).filter(Boolean);
  const prev = (configManager.get('context.includeDirectories') as string[] | undefined) || [];
  configManager.set('context.includeDirectories', [...new Set([...prev, ...dirs])]);
  console.log(chalk.green('Added:'), dirs.join(', '));
});
dirCmd.command('show').description('Show workspace directories').action(() => {
  const dirs = (configManager.get('context.includeDirectories') as string[] | undefined) || [];
  console.log(chalk.bold('Workspace directories:'));
  dirs.forEach((d) => console.log('  ', d));
  if (!dirs.length) console.log(chalk.dim('  (none)'));
});

// --- editor (stub)
program.command('editor [path]').description('Set external editor preference').action((pathArg?: string) => {
  if (pathArg) configManager.set('general.preferredEditor', pathArg);
  console.log('Preferred editor:', configManager.get('general.preferredEditor') || chalk.dim('(not set)'));
});

// --- help
program.command('help').description('Show help for Brunella CLI').action(() => {
  program.outputHelp();
});

// --- init (create BRUNELLA.md / GEMINI.md stub)
program.command('init').description('Analyze project and create BRUNELLA.md').action(() => {
  const cwd = process.cwd();
  const f = join(cwd, 'BRUNELLA.md');
  if (existsSync(f)) {
    console.log(chalk.yellow('BRUNELLA.md already exists.'));
    return;
  }
  const defaultContent = '# Brunella project context\n\nAdd instructions and context for the CLI here.\n';
  try {
    writeFileSync(f, defaultContent, 'utf-8');
    console.log(chalk.green('Created'), f);
  } catch (e: unknown) {
    console.error(chalk.red('Failed to create BRUNELLA.md'), (e as Error).message);
  }
});

// --- memory (Gemini-style: GEMINI.md/BRUNELLA.md discovery, @path imports)
const memCmd = program.command('memory').description('Memory / context files (BRUNELLA.md, GEMINI.md discovery)');
memCmd.command('show').description('Show current memory contents').action(() => {
  const config = {
    fileName: configManager.get('context.fileName') as string | string[] | undefined,
    includeDirectories: configManager.get('context.includeDirectories') as string[] | undefined,
    discoveryMaxDirs: configManager.get('context.discoveryMaxDirs') as number | undefined
  };
  const { paths, combined } = getMemory(process.cwd(), config);
  console.log(chalk.bold('Context paths:'), paths.length);
  paths.forEach((p) => console.log(chalk.dim('  ' + p)));
  if (combined.trim()) console.log(chalk.bold('\nCombined content:\n'), combined.slice(0, 4000) + (combined.length > 4000 ? '\n...' : ''));
});
memCmd.command('list').description('List paths of context files in use').action(() => {
  const config = {
    fileName: configManager.get('context.fileName') as string | string[] | undefined,
    includeDirectories: configManager.get('context.includeDirectories') as string[] | undefined
  };
  const { paths } = getMemory(process.cwd(), config);
  paths.forEach((p) => console.log('  ', p));
  if (!paths.length) console.log(chalk.dim('  (none found)'));
});
memCmd.command('refresh').description('Refresh memory from source').action(() => {
  const config = {
    fileName: configManager.get('context.fileName') as string | string[] | undefined,
    includeDirectories: configManager.get('context.includeDirectories') as string[] | undefined
  };
  getMemory(process.cwd(), config);
  console.log(chalk.green('Memory refreshed (reload on next chat).'));
});
memCmd.command('add <content>').description('Add content to memory').action((content: string) => {
  console.log(chalk.dim('Memory add: append to BRUNELLA.md or a file listed by `brunella memory list`.'));
});

// --- model
program.command('model [name]').description('Configure the model').action((name?: string) => {
  if (name) configManager.set('model.name', name);
  console.log('Model:', configManager.get('model.name') || chalk.dim('(default)'));
});

// --- privacy
program.command('privacy').description('Display privacy notice').action(() => {
  console.log(chalk.bold('Privacy'));
  console.log('Usage statistics can be disabled via config: privacy.usageStatisticsEnabled = false');
  console.log('Telemetry: config telemetry.enabled, telemetry.logPrompts. See settings.');
});

// --- policies
const policiesCmd = program.command('policies').description('Manage policies');
policiesCmd.command('list').description('List active policies').action(() => {
  console.log(chalk.dim('Policies: (stub) none configured.'));
});

// --- resume (stub)
program.command('resume [id]').description('Resume auto-saved conversation').action((id?: string) => {
  console.log(chalk.dim('Resume: use chat and load from checkpoint when implemented. ID:', id || 'latest'));
});

// --- stats
const statsCmd = program.command('stats').description('Session stats');
statsCmd.command('session').description('Session-specific stats').action(() => {
  console.log(chalk.bold('Session stats (stub)'));
});
statsCmd.command('model').description('Model-specific stats').action(() => {
  console.log(chalk.bold('Model stats (stub)'));
});
statsCmd.command('tools').description('Tool-specific stats').action(() => {
  console.log(chalk.bold('Tool stats (stub)'));
});
statsCmd.action(() => {
  console.log(chalk.dim('Use: brunella stats session | stats model | stats tools'));
});

// --- theme
program.command('theme [name]').description('Change theme (e.g. dark, light)').action((name?: string) => {
  if (name) configManager.set('ui.theme', name);
  console.log('Theme:', configManager.get('ui.theme') || configManager.get('theme') || 'dark');
});

// --- vim
program.command('vim').description('Toggle vim mode').action(() => {
  const cur = !!configManager.get('general.vimMode');
  configManager.set('general.vimMode', !cur);
  console.log(chalk.green('Vim mode:'), !cur ? 'on' : 'off');
});

// --- hooks (Gemini parity: panel/list, enable/disable via hooksConfig.disabled)
const hooksCmd = program.command('hooks').description('Manage hooks');
hooksCmd.command('panel').description('Show registered hooks and status').action(() => {
  const list = listHooks();
  const disabled = (configManager.get('hooksConfig.disabled') as string[] | undefined) ?? [];
  const enabled = (configManager.get('hooksConfig.enabled') as boolean) ?? true;
  console.log(chalk.bold('Hooks:'), enabled ? 'on' : chalk.dim('off'));
  list.forEach(({ name, count }) => {
    const dis = disabled.includes(name);
    console.log((dis ? chalk.dim('□ ') : chalk.green('■ ')) + name + chalk.dim(` (${count})`));
  });
  if (!list.length) console.log(chalk.dim('  No hooks registered.'));
});
hooksCmd.command('enable <name>').description('Enable a hook by name').action((name: string) => {
  const prev = (configManager.get('hooksConfig.disabled') as string[] | undefined) ?? [];
  configManager.set('hooksConfig.disabled', prev.filter((n) => n !== name));
  console.log(chalk.green('Enabled hook:'), name);
});
hooksCmd.command('disable <name>').description('Disable a hook by name').action((name: string) => {
  const prev = (configManager.get('hooksConfig.disabled') as string[] | undefined) ?? [];
  if (!prev.includes(name)) configManager.set('hooksConfig.disabled', [...prev, name]);
  console.log(chalk.green('Disabled hook:'), name);
});
hooksCmd.command('enable-all').description('Enable all hooks').action(() => {
  configManager.set('hooksConfig.disabled', []);
  console.log(chalk.green('All hooks enabled.'));
});
hooksCmd.command('disable-all').description('Disable all hooks').action(() => {
  const list = listHooks().map((x) => x.name);
  configManager.set('hooksConfig.disabled', list);
  console.log(chalk.green('All hooks disabled.'));
});

// --- extensions (stubs)
const extCmd = program.command('extensions').description('Manage extensions');
extCmd.command('list').description('List active extensions').action(() => console.log(chalk.dim('Extensions: (stub) none.')));
extCmd.command('update [names]').description('Update extensions').action(() => console.log(chalk.dim('Extensions: (stub).')));
extCmd.command('explore').description('Open extensions in browser').action(() => console.log(chalk.dim('Extensions: (stub).')));
extCmd.command('restart').description('Restart extensions').action(() => console.log(chalk.dim('Extensions: (stub).')));

// --- skills (Gemini parity: list from ~/.brunella/skills, enable/disable via config skills.disabled)
const skillsCmd = program.command('skills').description('Agent skills');
skillsCmd.command('list').description('List skills').option('--nodesc', 'Hide descriptions').option('--all', 'Include disabled').action((cmd?: { opts: () => { nodesc?: boolean; all?: boolean } }) => {
  const opts = cmd?.opts?.() ?? {};
  const skills = discoverSkills(undefined, process.cwd());
  const disabled = (configManager.get('skills.disabled') as string[] | undefined) ?? [];
  const show = opts.all ? skills : skills.filter((s) => !disabled.includes(s.name));
  console.log(chalk.bold('Skills:'), show.length);
  show.forEach((s) => {
    const line = (disabled.includes(s.name) ? chalk.dim('□ ') : chalk.green('■ ')) + s.name;
    console.log(line + (opts.nodesc ? '' : (s.description ? chalk.dim(' — ' + s.description) : '')));
  });
});
skillsCmd.command('disable <name>').description('Disable a skill').action((name: string) => {
  const prev = (configManager.get('skills.disabled') as string[] | undefined) ?? [];
  if (!prev.includes(name)) configManager.set('skills.disabled', [...prev, name]);
  console.log(chalk.green('Disabled skill:'), name);
});
skillsCmd.command('enable <name>').description('Enable a skill').action((name: string) => {
  const prev = (configManager.get('skills.disabled') as string[] | undefined) ?? [];
  configManager.set('skills.disabled', prev.filter((n) => n !== name));
  console.log(chalk.green('Enabled skill:'), name);
});
skillsCmd.command('reload').description('Reload skills').action(() => {
  discoverSkills(undefined, process.cwd());
  console.log(chalk.green('Skills reloaded (run `skills list` to see).'));
});

// --- mcp (list = tools; desc/schema/refresh stubs)
const mcpCmd = program.command('mcp').description('Manage MCP servers');
mcpCmd.command('list').description('List MCP servers and tools').action(async () => {
  const client = new BrunellaClient();
  try {
    await client.connect();
    const r = await client.listTools();
    console.log(chalk.bold('MCP tools:'), r.tools.length);
    r.tools.forEach((t) => console.log('  ', t.name, t.description ? chalk.dim('- ' + t.description) : ''));
  } catch (e: unknown) {
    console.error(chalk.red((e as Error).message));
  } finally {
    await client.close();
  }
});
mcpCmd.command('desc').description('List with descriptions').action(async () => {
  const client = new BrunellaClient();
  try {
    await client.connect();
    const r = await client.listTools();
    r.tools.forEach((t) => console.log(chalk.green(t.name), '—', t.description || ''));
  } catch (e: unknown) {
    console.error(chalk.red((e as Error).message));
  } finally {
    await client.close();
  }
});
mcpCmd.command('schema').description('List with schemas').action(async () => {
  const client = new BrunellaClient();
  try {
    await client.connect();
    const r = await client.listTools();
    console.log(JSON.stringify(r.tools, null, 2));
  } catch (e: unknown) {
    console.error(chalk.red((e as Error).message));
  } finally {
    await client.close();
  }
});
mcpCmd.command('refresh').description('Restart MCP servers').action(() => console.log(chalk.dim('MCP refresh: reconnect on next command.')));
mcpCmd.command('auth').description('Authenticate OAuth MCP server').action(() => console.log(chalk.dim('MCP auth: (stub).')));

// --- setup-github, terminal-setup (stubs)
program.command('setup-github').description('Set up GitHub Actions').action(() => console.log(chalk.dim('Setup GitHub: (stub).')));
program.command('terminal-setup').description('Configure terminal keybindings').action(() => console.log(chalk.dim('Terminal setup: (stub).')));
program.command('ide').description('Manage IDE integration').action(() => console.log(chalk.dim('IDE: (stub).')));

program.command('tools')
  .description('List available MCP tools. Usage: tools [--json] [--desc] [--schema]')
  .option('--json', 'Output as JSON')
  .option('--desc', 'Include descriptions (default in table)')
  .option('--schema', 'Include inputSchema in JSON output')
  .action(async (options: { json?: boolean; desc?: boolean; schema?: boolean }) => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.listTools();
      const tools = result.tools as Array<{ name: string; description?: string; inputSchema?: unknown }>;

      if (options.json || options.schema) {
        const out = options.schema ? tools : tools.map((t) => ({ name: t.name, description: t.description }));
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.log(chalk.bold(`Available Tools (${tools.length}):`));
        const showDesc = options.desc !== false;
        for (const tool of tools) {
          const line = chalk.green('• ' + tool.name) + (showDesc && tool.description ? ': ' + chalk.dim(tool.description) : '');
          console.log(line);
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red('Error fetching tools:'), (error as Error).message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

program.command('run <toolName> [args...]')
  .description('Run an MCP tool (pass args as key=value or single JSON string). Output: text | [resource] | [file]')
  .option('--json', 'Output raw JSON response')
  .action(async (toolName: string, args: string[] = [], cmd?: { opts: () => { json?: boolean } }) => {
    const exclude = (configManager.get('tools.exclude') as string[] | undefined) ?? [];
    if (exclude.includes(toolName)) {
      console.error(chalk.red(`Tool '${toolName}' is excluded by config (tools.exclude).`));
      process.exit(1);
    }
    const opts = cmd?.opts?.() ?? {};
    const parsedArgs: Record<string, string> = {};
    if (args?.length === 1 && args[0].trim().startsWith('{')) {
      try {
        Object.assign(parsedArgs, JSON.parse(args[0]) as Record<string, string>);
      } catch {
        console.error(chalk.red('Invalid JSON argument'));
        process.exit(1);
      }
    } else {
      for (const arg of args || []) {
        const parts = arg.split('=');
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join('=');
          parsedArgs[key] = value;
        }
      }
    }

    const client = new BrunellaClient();
    const start = Date.now();
    try {
      await client.connect();
      const result = await client.callTool(toolName, parsedArgs);
      const durationMs = Date.now() - start;
      if (isTelemetryEnabled()) recordToolCall(toolName, durationMs, true);

      const res = result as { content?: Array<{ type: string; text?: string; resource?: unknown }> };
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (res.content && Array.isArray(res.content)) {
        for (const item of res.content) {
          if (item.type === 'text' && item.text != null) {
            process.stdout.write(item.text + (item.text.endsWith('\n') ? '' : '\n'));
          } else if (item.type === 'resource') {
            console.log(chalk.yellow('[resource]'), typeof item.resource === 'object' ? JSON.stringify(item.resource) : item.resource);
          } else {
            console.log(chalk.yellow(`[${item.type}]`), (item as { text?: string }).text ?? '');
          }
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      if (isTelemetryEnabled()) recordToolCall(toolName, durationMs, false);
      console.error(chalk.red('Tool execution failed:'), (error as Error).message);
      process.exit(1);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

program.command('chat')
  .description('Interactive chat with Brunella')
  .option('-m, --model <name>', 'Model to use (overrides config)')
  .action(async (opts: { model?: string }) => {
    marked.setOptions({
      renderer: new TerminalRenderer() as any
    });

    const model = opts?.model || (configManager.get('model.name') as string) || 'llama3.1';
    console.log(chalk.cyan("Starting chat... (Type 'exit' to quit)") + chalk.dim(` [model: ${model}]`));

    const client = new BrunellaClient();
    try {
      await client.connect();

      let context = "";

      while (true) {
        const { prompt } = await inquirer.prompt([{
          type: 'input',
          name: 'prompt',
          message: 'You:',
        }]);

        if (prompt.toLowerCase() === 'exit') break;

        const fullPrompt = context ? `${context}\nUser: ${prompt}\nAssistant:` : `User: ${prompt}\nAssistant:`;

        const spinner = ora('Thinking...').start();
        try {
          const result = await client.callTool('ollama_generate', {
            prompt: fullPrompt,
            model
          });
          spinner.stop();

          const res = result as any;
          if (res.isError) {
            console.log(chalk.red("Error:"), res.content?.[0]?.text);
          } else {
            const response = res.content?.[0]?.text || "";
            console.log(chalk.green('Brunella:'));
            // Incremental-style render: print markdown in one pass (streaming would need backend support)
            console.log(marked(response));

            context += `\nUser: ${prompt}\nAssistant: ${response}`;
          }
        } catch (err: unknown) {
          spinner.stop();
          console.error(chalk.red("Error calling tool:"), (err as Error).message);
        }
      }
    } catch (e: unknown) {
      console.error(chalk.red("Chat error:"), (e as Error).message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

const agentsCmd = program.command('agents').description('List available agents. Usage: agents [--json] | agents describe <name>');
agentsCmd
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.callTool('agent_list', {});
      const res = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      const text = res.content?.[0]?.text;
      if (res.isError || !text?.trim()) {
        console.log(chalk.dim('No agents found.'));
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.log(chalk.dim('Agents (raw):'), text);
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log(chalk.bold('Active Agents:'));
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const a of list) {
          const agent = a as { name?: string; role?: string; description?: string };
          console.log(chalk.green('• ' + (agent.name ?? '?')) + (agent.role ? chalk.dim(` (${agent.role})`) : ''));
          if (agent.description) console.log(chalk.dim('  ' + agent.description));
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red('Error listing agents:'), (error as Error).message);
      process.exit(1);
    } finally {
      await client.close();
      process.exit(0);
    }
  });
agentsCmd.command('describe <name>').description('Describe an agent by name').action(async (name: string) => {
  const client = new BrunellaClient();
  try {
    await client.connect();
    const result = await client.callTool('agent_list', {});
    const res = result as { content?: Array<{ text?: string }> };
    const text = res.content?.[0]?.text;
    if (!text) {
      console.log(chalk.dim('No agents found.'));
      return;
    }
    const agents = JSON.parse(text) as Array<{ name?: string; role?: string; description?: string }>;
    const agent = Array.isArray(agents) ? agents.find((a) => (a.name ?? '').toLowerCase() === name.toLowerCase()) : null;
    if (!agent) {
      console.log(chalk.red(`Agent '${name}' not found.`));
      return;
    }
    console.log(chalk.bold(agent.name ?? name));
    if (agent.role) console.log(chalk.cyan('Role:'), agent.role);
    if (agent.description) console.log(chalk.dim(agent.description));
  } catch (e: unknown) {
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
});

program.command('delegate <agentName> <task>')
  .description('Delegate a task to an agent')
  .option('--json', 'Output raw JSON response')
  .action(async (agentName: string, task: string, opts: { json?: boolean }) => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const spinner = ora(`Delegating to ${agentName}...`).start();
      const result = await client.callTool('agent_delegate', { agent_name: agentName, task });
      spinner.stop();
      const res = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (res.isError) {
        const err = res.content?.[0]?.text;
        console.error(chalk.red('Delegation failed:'), err ?? 'Unknown error');
        process.exit(1);
      }
      if (res.content?.length) {
        for (const item of res.content) {
          if (item.type === 'text' && item.text != null) {
            console.log(chalk.green('Result:'));
            console.log(item.text);
          }
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red('Delegation failed:'), (error as Error).message);
      process.exit(1);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

program.command('interpreter')
  .description('Start an interactive Python interpreter (Open Interpreter mode)')
  .action(async () => {
    console.log(chalk.blue(boxen('Brunella Python Interpreter', { padding: 1, borderStyle: 'round' })));
    console.log(chalk.dim("Type 'exit' to quit soha. Type 'reset' to clear state."));

    const client = new BrunellaClient();
    try {
      await client.connect();

      while (true) {
        const { code } = await inquirer.prompt([{
          type: 'input', // multiline would be better but simple input for now
          name: 'code',
          message: '>>>',
        }]);

        if (code.toLowerCase() === 'exit') break;
        if (code.trim() === '') continue;

        if (code.toLowerCase() === 'reset') {
          const spinner = ora('Resetting shell...').start();
          await client.callTool('interpreter_run_python', { code: 'print("Reset")', reset: true });
          spinner.stop();
          console.log(chalk.yellow("Environment reset."));
          continue;
        }

        const spinner = ora('Executing...').start();
        try {
          const result = await client.callTool('interpreter_run_python', { code });
          spinner.stop();

          const res = result as any;
          if (res.isError) {
            console.log(chalk.red("Error:"), res.content?.[0]?.text);
          } else {
            const output = res.content?.[0]?.text || "";
            if (output) console.log(output);
          }
        } catch (err: any) {
          spinner.stop();
          console.error(chalk.red("Execution failed:"), err.message);
        }
      }
    } catch (e: any) {
      console.error(chalk.red("Interpreter error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

program.parse(process.argv);
