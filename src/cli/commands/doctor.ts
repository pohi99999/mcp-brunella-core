import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { McpConfigManager } from '../mcp_config.js';
import { ExtensionManager } from '../extensions.js';
import { MemoryManager } from '../memory.js';
import { McpClientManager } from '../mcp_client.js';

export async function doctorCommand(options?: { json?: boolean }) {
  const configManager = new McpConfigManager();
  const extensionManager = new ExtensionManager();
  const memory = new MemoryManager();
  const mcpClient = new McpClientManager();
  const brunellaHome = process.env.BRUNELLA_HOME || path.join(os.homedir(), '.brunella');
  const memoryFile = path.join(brunellaHome, 'cli_memory.json');

  const report: Record<string, any> = {
    config: {},
    memory: {},
    extensions: {},
    runtime: {},
    mcpServers: []
  };

  if (!options?.json) {
    console.log(chalk.bold.cyan('\n🩺 Brunella Doctor'));
  }

  // Config file check
  const configPath = configManager.getConfigPath();
  const configExists = fs.existsSync(configPath);
  report.config = { path: configPath, exists: configExists };
  if (!options?.json) {
    console.log(`${status(configExists)} MCP config: ${configPath}`);
  }

  // Memory check
  const memoryExists = fs.existsSync(memoryFile);
  report.memory = { path: memoryFile, exists: memoryExists };
  if (!options?.json) {
    console.log(`${status(memoryExists)} CLI memory: ${memoryFile}`);
  }

  // Extensions check
  const extensionRoot = extensionManager.getExtensionRoot();
  const extRootExists = fs.existsSync(extensionRoot);
  report.extensions = { path: extensionRoot, exists: extRootExists };
  if (!options?.json) {
    console.log(`${status(extRootExists)} Extensions dir: ${extensionRoot}`);
  }

  // Runtime checks
  const npmVersion = safeExec('npm -v');
  const tsNodePath = path.join(process.cwd(), 'node_modules', 'ts-node');
  const playwrightStatus = getPlaywrightInstallStatus();
  const llmBaseUrl = memory.get('llm_base_url') || 'http://127.0.0.1:11434';
  const llmModel = memory.get('model') || 'llava-llama3:latest';

  report.runtime = {
    node: process.version,
    npm: npmVersion || null,
    tsNode: { path: tsNodePath, exists: fs.existsSync(tsNodePath) },
    playwright: playwrightStatus,
    llmBaseUrl,
    llmModel
  };

  if (!options?.json) {
    console.log(chalk.cyan('\n🧪 Runtime ellenőrzés:'));
    console.log(`${chalk.green('✔')} Node: ${process.version}`);
    console.log(`${status(Boolean(npmVersion))} npm: ${npmVersion || 'nem elérhető'}`);
    console.log(`${status(fs.existsSync(tsNodePath))} ts-node: ${tsNodePath}`);
    console.log(`${status(playwrightStatus.installed)} playwright: ${playwrightStatus.installed ? 'installed' : 'missing'}`);
    if (!playwrightStatus.installed) {
      console.log(chalk.yellow('  Hint: npx playwright install'));
    }
    console.log(`${chalk.green('✔')} LLM base URL: ${llmBaseUrl}`);
    console.log(`${chalk.green('✔')} LLM model: ${llmModel}`);
  }

  const ollamaStatus = await checkOllama(llmBaseUrl);
  report.runtime.ollama = ollamaStatus;
  if (!options?.json) {
    const label = ollamaStatus.ok ? chalk.green('✔') : chalk.red('✖');
    const detail = ollamaStatus.error ? ` (${ollamaStatus.error})` : '';
    console.log(`${label} Ollama: ${ollamaStatus.ok ? 'elérhető' : 'nem elérhető'}${detail}`);
    if (ollamaStatus.models?.length) {
      console.log(chalk.gray(`  Models: ${ollamaStatus.models.join(', ')}`));
    }
  }

  // MCP server env hints
  try {
    const servers = configManager.getServers();
    if (servers.length > 0) {
      if (!options?.json) {
        console.log(chalk.cyan('\n🔌 MCP szerverek ellenőrzése:'));
      }
      for (const server of servers) {
        const missingEnv = Object.entries(server.env || {})
          .filter(([_, value]) => !value)
          .map(([key]) => key);
        const ping = await pingMcpServer(mcpClient, server);
        report.mcpServers.push({
          name: server.name,
          missingEnv,
          ping
        });
        if (!options?.json) {
          const envHint = missingEnv.length > 0
            ? chalk.yellow(` (hiányzó env: ${missingEnv.join(', ')})`)
            : chalk.green(' (env OK)');
          const pingHint = ping.status === 'ok'
            ? chalk.green(' (ping OK)')
            : ping.status === 'skipped'
              ? chalk.gray(` (ping: ${ping.reason})`)
              : chalk.red(` (ping: ${ping.reason})`);
          console.log(`${chalk.green('✔')} ${server.name}${envHint}${pingHint}`);
        }
      }
    }
  } catch (e: any) {
    report.mcpServersError = e.message;
    if (!options?.json) {
      console.log(chalk.red(`MCP config hiba: ${e.message}`));
    }
  }
  if (options?.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log();
  }
}

function status(ok: boolean) {
  return ok ? chalk.green('✔') : chalk.red('✖');
}

function safeExec(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

async function checkOllama(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const data = await res.json().catch(() => null);
    const list = (data as any)?.models;
    const models = Array.isArray(list)
      ? list.map((m: any) => m?.name).filter(Boolean)
      : [];
    return { ok: true, status: res.status, models };
  } catch (error: any) {
    clearTimeout(timeout);
    return { ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}

function getPlaywrightInstallStatus() {
  const modulePath = path.join(process.cwd(), 'node_modules', 'playwright');
  const corePath = path.join(process.cwd(), 'node_modules', 'playwright-core');
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  candidates.push(path.join(process.cwd(), 'node_modules', 'playwright', '.local-browsers'));
  candidates.push(path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers'));
  candidates.push(path.join(os.homedir(), '.cache', 'ms-playwright'));
  candidates.push(path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'));

  const browsersPath = candidates.find(p => p && fs.existsSync(p)) || null;
  return {
    module: fs.existsSync(modulePath) || fs.existsSync(corePath),
    installed: Boolean(browsersPath),
    browsersPath
  };
}

async function pingMcpServer(client: McpClientManager, server: { name: string; command: string; args: string[]; env?: Record<string, string> }) {
  // Skip potentially heavy installs (npx) and external deps (docker)
  if (server.command !== 'node') {
    return { status: 'skipped', reason: 'non-local command' };
  }
  try {
    await client.connectStdio(server.name, server.command, server.args, server.env || {}, 1);
    client.startWatchdog(server.name, 10000);
    const health = await client.healthCheck(server.name);
    await client.disconnectAll();
    return health;
  } catch (error: any) {
    await client.disconnectAll();
    return { status: 'error', reason: error.message };
  }
}
