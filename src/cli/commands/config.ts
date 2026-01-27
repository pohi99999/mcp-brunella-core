import chalk from 'chalk';
import { McpConfigManager } from '../mcp_config.js';

const configManager = new McpConfigManager();

export async function configCommand(action: string, name?: string, json?: string) {
  switch (action) {
    case 'path':
      console.log(chalk.cyan(`MCP config path: ${configManager.getConfigPath()}`));
      break;
    case 'list':
      listServers();
      break;
    case 'show':
      showServer(name);
      break;
    case 'add':
      addServer(name, json);
      break;
    case 'update':
      updateServer(name, json);
      break;
    case 'remove':
      removeServer(name);
      break;
    default:
      console.log(chalk.red(`Ismeretlen művelet: ${action}`));
      console.log(chalk.yellow('Használat: brunella config <path|list|show|add|update|remove> [name] [json]'));
  }
}

function listServers() {
  const servers = configManager.getServers();
  console.log(chalk.cyan('🔧 MCP szerverek (mcp_servers.json):'));
  servers.forEach(server => {
    console.log(`${chalk.green('✔')} ${chalk.bold(server.name)} - ${server.command} ${server.args.join(' ')}`);
  });
}

function showServer(name?: string) {
  if (!name) {
    console.log(chalk.red('Hiba: Add meg a szerver nevét.'));
    return;
  }
  const servers = configManager.getServers();
  const server = servers.find(s => s.name === name);
  if (!server) {
    console.log(chalk.red(`Hiba: Nincs ilyen szerver: ${name}`));
    return;
  }
  console.log(chalk.cyan(`🔧 MCP szerver: ${server.name}`));
  console.log(JSON.stringify(server, null, 2));
}

function addServer(name?: string, json?: string) {
  const server = parseServerInput(name, json);
  if (!server) return;
  try {
    configManager.addServer(server);
    console.log(chalk.green(`✔ Szerver hozzáadva: ${server.name}`));
  } catch (error: any) {
    console.log(chalk.red(`✖ Hiba: ${error.message}`));
  }
}

function updateServer(name?: string, json?: string) {
  if (!name) {
    console.log(chalk.red('Hiba: Add meg a szerver nevét.'));
    return;
  }
  const patch = parsePatchInput(json);
  if (!patch) return;
  try {
    configManager.updateServer(name, patch);
    console.log(chalk.green(`✔ Szerver frissítve: ${name}`));
  } catch (error: any) {
    console.log(chalk.red(`✖ Hiba: ${error.message}`));
  }
}

function removeServer(name?: string) {
  if (!name) {
    console.log(chalk.red('Hiba: Add meg a szerver nevét.'));
    return;
  }
  try {
    configManager.removeServer(name);
    console.log(chalk.green(`✔ Szerver törölve: ${name}`));
  } catch (error: any) {
    console.log(chalk.red(`✖ Hiba: ${error.message}`));
  }
}

function parseServerInput(name?: string, json?: string) {
  if (!json) {
    console.log(chalk.red('Hiba: Hiányzik a JSON konfiguráció.'));
    console.log(chalk.dim('Példa: brunella config add myserver {"command":"node","args":["./build/index.js"]}'));
    return null;
  }
  try {
    const parsed = JSON.parse(json);
    const serverName = parsed.name || name;
    if (!serverName || !parsed.command || !Array.isArray(parsed.args)) {
      console.log(chalk.red('Hiba: A JSON-nak tartalmaznia kell: command, args (array).'));
      return null;
    }
    return {
      name: serverName,
      command: parsed.command,
      args: parsed.args,
      env: parsed.env
    };
  } catch {
    console.log(chalk.red('Hiba: A JSON paraméterek érvénytelenek.'));
    return null;
  }
}

function parsePatchInput(json?: string) {
  if (!json) {
    console.log(chalk.red('Hiba: Hiányzik a JSON patch.'));
    console.log(chalk.dim('Példa: brunella config update myserver {"env":{"TOKEN":"..."} }'));
    return null;
  }
  try {
    const parsed = JSON.parse(json);
    const patch: any = {};
    if (parsed.command) patch.command = parsed.command;
    if (parsed.args) patch.args = parsed.args;
    if (parsed.env) patch.env = parsed.env;
    return patch;
  } catch {
    console.log(chalk.red('Hiba: A JSON paraméterek érvénytelenek.'));
    return null;
  }
}
