#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configManager } from './utils/cliConfig.js';
import { BrunellaClient } from './utils/mcpClient.js';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import inquirer from 'inquirer';
import ora from 'ora';
import { initTelemetryFromConfig, recordSessionStart, flushTelemetry, recordToolCall, isTelemetryEnabled } from './utils/telemetry.js';
import { getMemory } from './utils/memoryContext.js';
import { discoverSkills } from './utils/skillsLoader.js';
import { listHooks } from './utils/hooks.js';
import { startInteractiveMenu } from './interactive.js';

const program = new Command();

// Try to read package.json version
let version = '0.0.0';
try {
  // Try relative to build location first, then src
  let pkgPath = join(__dirname, '../package.json');
  if (!existsSync(pkgPath)) pkgPath = join(__dirname, '../../package.json');
  
  if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      version = pkg.version;
  }
} catch (e) {
  // ignore
}

const rawArgs = process.argv.slice(2);
const showBanner =
  !rawArgs.some((a) => a === '--version' || a === '-V' || a === '--help' || a === '-h') &&
  !(configManager.get('ui.hideBanner') as boolean);

if (showBanner && rawArgs.length > 0) {
  console.log(boxen(chalk.blue('Brunella CLI') + ` v${version}`, { padding: 1, borderStyle: 'round' }));
}

// Telemetry from config (nested settings.telemetry)
try {
  const all = configManager.getAll() as { telemetry?: { enabled?: boolean; target?: string }; serverUrl?: string };
  initTelemetryFromConfig(all as any);
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

// --- auth
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

// --- doctor
program.command('doctor').description('Run system diagnostics').action(async () => {
    console.log(chalk.bold('🩺 Brunella Doctor'));
    
    // Check Node
    console.log(`✔ Node: ${process.version}`);
    
    // Check Server Connection
    const client = new BrunellaClient();
    try {
        await client.connect();
        console.log(chalk.green('✔ Server: Connected'));
        
        // Check Agents
        const agents = await client.callTool('agent_list', {});
        // @ts-ignore
        if (agents.content[0].text) {
             console.log(chalk.green('✔ Agents: Active'));
        }
        
    } catch (e: any) {
        console.log(chalk.red(`✖ Server: Connection failed (${e.message})`));
    } finally {
        await client.close();
    }
});

// --- connect (MCP)
program.command('connect <serverName>')
    .description('Connect to an external MCP server (github, chrome, docker)')
    .action(async (serverName: string) => {
        console.log(chalk.cyan(`Connecting to ${serverName}...`));
        console.log(chalk.dim("Feature coming soon: Dynamic MCP config update."));
        console.log(chalk.dim(`Please add '${serverName}' manually to mcp_servers.json for now.`));
    });

// --- tools
program.command('tools')
  .description('List available MCP tools')
  .action(async () => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.listTools();
      const tools = result.tools;

      console.log(chalk.bold(`Available Tools (${tools.length}):`));
      for (const tool of tools) {
        console.log(chalk.green('• ' + tool.name) + (tool.description ? ': ' + chalk.dim(tool.description) : ''));
      }
    } catch (error: any) {
      console.error(chalk.red('Error fetching tools:'), error.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- agents
program.command('agents')
  .description('List all registered AI agents')
  .action(async () => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      // Use the agent_list tool
      const result = await client.callTool('agent_list', {});
      // @ts-ignore
      const text = result.content?.[0]?.text;
      if (text) {
          console.log(chalk.bold('Registered Agents:'));
          console.log(text);
      } else {
          console.log(chalk.yellow('No agents found or tool returned empty result.'));
      }
    } catch (error: any) {
      console.error(chalk.red('Error fetching agents:'), error.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- run
program.command('run <toolName> [args...]')
  .description('Run an MCP tool')
  .option('--json', 'Output raw JSON response')
  .action(async (toolName: string, args: string[] = [], cmd?: { opts: () => { json?: boolean } }) => {
    const opts = cmd?.opts?.() ?? {};
    const parsedArgs: Record<string, string> = {};
    
    for (const arg of args || []) {
        const parts = arg.split('=');
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join('=');
          parsedArgs[key] = value;
        } else if (arg.startsWith('{')) {
             try {
                Object.assign(parsedArgs, JSON.parse(arg));
             } catch {}
        }
    }

    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.callTool(toolName, parsedArgs);
      
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // @ts-ignore
        const text = result.content?.[0]?.text;
        if (text) console.log(text);
        else console.log(JSON.stringify(result, null, 2));
      }
    } catch (error: any) {
      console.error(chalk.red('Tool execution failed:'), error.message);
      process.exit(1);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- chat
program.command('chat')
  .description('Interactive chat with Brunella')
  .action(async () => {
    marked.setOptions({ renderer: new TerminalRenderer() as any });
    
    console.log(chalk.cyan("Starting chat... (Type 'exit' to quit, /switch <provider> to change LLM provider)"));

    const client = new BrunellaClient();
    try {
      await client.connect();
      
      let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      let activeProvider: 'ollama' | 'gemini' | 'claude' | 'openai' = 'ollama';

      while (true) {
        const { prompt } = await inquirer.prompt([{
          type: 'input',
          name: 'prompt',
          message: 'Brunella ❯',
        }]);

        if (prompt.toLowerCase() === 'exit') break;

        if (prompt.startsWith('/switch ')) {
            const newProvider = prompt.split(' ')[1];
            if (['ollama', 'gemini', 'claude', 'openai'].includes(newProvider)) {
                activeProvider = newProvider as any;
                console.log(chalk.yellow(`Switched to ${activeProvider} provider.`));
                history = []; // Reset history on provider switch
                continue;
            } else {
                console.log(chalk.red(`Invalid provider. Available: ollama, gemini, claude, openai`));
                continue;
            }
        }

        history.push({ role: 'user', content: prompt });

        const spinner = ora('Thinking...').start();
        try {
            const result = await client.callTool('agent_delegate', {
                agent_name: 'Orchestrator',
                task: prompt,
                context: {
                    history: history,
                    provider: activeProvider
                }
            });
            
            spinner.stop();
            // @ts-ignore
            const response = result.content?.[0]?.text || "No response";
            
            history.push({ role: 'assistant', content: response });
            
            console.log(chalk.green('Brunella:'));
            console.log(marked(response));

        } catch (err: any) {
          spinner.stop();
          console.error(chalk.red("Error:"), err.message);
        }
      }
    } catch (e: any) {
      console.error(chalk.red("Chat error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- interpreter
program.command('interpreter')
  .description('Interactive Python Interpreter')
  .action(async () => {
      console.log(chalk.blue(boxen('Brunella Python Interpreter', { padding: 1, borderStyle: 'round' })));
      const client = new BrunellaClient();
      try {
          await client.connect();

          while(true) {
              const { code } = await inquirer.prompt([{
                  type: 'input',
                  name: 'code',
                  message: '>>>'
              }]);

              if (code === 'exit') break;

              const result = await client.callTool('interpreter_run_python', { code });
              // @ts-ignore
              console.log(result.content[0].text);
          }
      } catch (e: any) {
          console.log(chalk.red(e.message));
      } finally {
          await client.close();
          process.exit(0);
      }
  });

// --- conductor (Project Management)
const conductorCmd = program.command('conductor').description('Project management and documentation sync');

conductorCmd.command('status')
  .description('Show project status and active tracks')
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora('Fetching project status...').start();
    try {
      await client.connect();
      const result = await client.callTool('agent_delegate', {
        agent_name: 'ProjectConductor',
        task: 'status'
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || 'No response';
      console.log(marked(response));
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red('Error:'), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

conductorCmd.command('sync')
  .description('Synchronize documentation files')
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora('Synchronizing documentation...').start();
    try {
      await client.connect();
      const result = await client.callTool('agent_delegate', {
        agent_name: 'ProjectConductor',
        task: 'sync'
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || 'Sync completed';
      console.log(chalk.green('✓'), response);
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red('Error:'), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

conductorCmd.command('health')
  .description('Run project health check (build, tests, docs)')
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora('Running health check...').start();
    try {
      await client.connect();
      const result = await client.callTool('agent_delegate', {
        agent_name: 'ProjectConductor',
        task: 'health'
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || 'Health check completed';
      console.log(marked(response));
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red('Error:'), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

conductorCmd.command('track <action> [name]')
  .description('Manage development tracks (create, update, list)')
  .action(async (action: string, name?: string) => {
    const client = new BrunellaClient();
    let task = action;
    if (action === 'create' && name) {
      task = `track create ${name}`;
    } else if (action === 'update') {
      task = 'track update';
    } else if (action === 'list') {
      task = 'status'; // Status shows track list
    }

    const spinner = ora(`Executing track ${action}...`).start();
    try {
      await client.connect();
      const result = await client.callTool('agent_delegate', {
        agent_name: 'ProjectConductor',
        task
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || 'Done';
      console.log(marked(response));
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red('Error:'), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// Interactive Menu (Default)
if (!process.argv.slice(2).length) {
    startInteractiveMenu();
} else {
    program.parse(process.argv);
}
