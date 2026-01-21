#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
// @ts-ignore
import io from "socket.io-client";
import { spawn } from 'child_process';
import { formatToolsTable, formatToolsJson } from './utils/cli_formatter.js';

const program = new Command();
const CONFIG_DIR = path.join(os.homedir(), '.brunella');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

function loadConfig(): any {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        // ignore
    }
    return {
        serverUrl: 'http://localhost:3000',
        apiKey: 'default-key'
    };
}

function saveConfig(config: any) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

class McpCliClient {
    private messageId = 0;
    private handlersCounter = new Map<number, (res: any) => void>();

    constructor(private socket: any) {
        this.socket.on('mcp_response', (response: any) => {
            const handler = this.handlersCounter.get(response.id);
            if (handler) {
                handler(response);
                this.handlersCounter.delete(response.id);
            }
        });
    }

    async request(method: string, params: any = {}): Promise<any> {
        const id = ++this.messageId;
        return new Promise((resolve, reject) => {
            this.handlersCounter.set(id, (res) => {
                if (res.error) {
                    reject(new Error(res.error.message || 'MCP Error'));
                } else {
                    resolve(res.result);
                }
            });

            this.socket.emit('mcp_message', {
                jsonrpc: '2.0',
                id,
                method,
                params
            });

            setTimeout(() => {
                if (this.handlersCounter.has(id)) {
                    this.handlersCounter.delete(id);
                    reject(new Error(`MCP Request Timeout: ${method}`));
                }
            }, 10000);
        });
    }

    async initialize() {
        return this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'brunella-cli', version: '4.0.0' }
        });
    }

    async listTools() {
        return this.request('tools/list');
    }

    async callTool(name: string, args: any) {
        return this.request('tools/call', {
            name,
            arguments: args
        });
    }
}

async function startServer(): Promise<void> {
    console.log(chalk.yellow('Szerver indítása a háttérben...'));
    const serverPath = path.join(process.cwd(), 'build', 'index.js');
    
    const out = fs.openSync(path.join(CONFIG_DIR, 'server.log'), 'a');
    const err = fs.openSync(path.join(CONFIG_DIR, 'server.log'), 'a');

    const child = spawn('node', [serverPath], {
        detached: true,
        stdio: ['ignore', out, err]
    });

    child.unref();
    
    // Várjunk egy kicsit az indulásra
    return new Promise(resolve => setTimeout(resolve, 3000));
}

async function connectToServer(config: any): Promise<any> {
    const tryConnect = (url: string, key: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            const socket = io(url, {
                auth: { token: key },
                transports: ['websocket'],
                autoConnect: false,
                timeout: 3000
            });

            socket.connect();
            
            socket.once('connect', () => resolve(socket));
            socket.once('connect_error', (err: any) => {
                socket.disconnect();
                reject(err);
            });
            setTimeout(() => {
                socket.disconnect();
                reject(new Error('Timeout'));
            }, 3500);
        });
    };

    try {
        console.log(chalk.blue(`Csatlakozás a szerverhez: ${config.serverUrl}...`));
        return await tryConnect(config.serverUrl, config.apiKey);
    } catch (err) {
        console.log(chalk.yellow('A szerver nem érhető el. Megpróbálom elindítani...'));
        await startServer();
        try {
            return await tryConnect(config.serverUrl, config.apiKey);
        } catch (retryErr: any) {
            throw new Error(`Szerver indítás után sem sikerült kapcsolódni: ${retryErr.message}`);
        }
    }
}

program
  .name('brunella')
  .description('Brunella Core CLI - MCP Powered Assistant')
  .version('4.0.0');

program
  .command('ping')
  .description('Ping the CLI to verify it is working')
  .action(() => {
    console.log(chalk.green('Pong! Brunella CLI is ready.'));
  });

program
  .command('config')
  .description('Manage CLI configuration')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .action((options) => {
    const config = loadConfig();
    
    if (options.set) {
      const [key, value] = options.set.split('=');
      if (key && value) {
        config[key] = value;
        saveConfig(config);
        console.log(chalk.green(`Configuration updated: ${key}=${value}`));
      } else {
        console.log(chalk.red('Invalid format. Use key=value'));
      }
      return;
    }

    console.log(chalk.blue.bold('Brunella CLI Configuration:'));
    Object.entries(config).forEach(([key, value]) => {
      console.log(`${chalk.yellow(key)}: ${value}`);
    });
  });

program
  .command('status')
  .description('Check server and connection status')
  .action(async () => {
    const config = loadConfig();
    try {
        const socket = await connectToServer(config);
        console.log(chalk.green('Status: ONLINE'));
        socket.disconnect();
    } catch (err: any) {
        console.log(chalk.red(`Status: OFFLINE (${err.message})`));
        console.log(chalk.yellow('Próbálom elindítani a szervert (még nincs implementálva)...'));
    }
  });

program
  .command('tools')
  .description('List available MCP tools')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig();
    try {
        const socket = await connectToServer(config);
        const client = new McpCliClient(socket);
        await client.initialize();
        
        const response = await client.listTools();
        const tools = response.tools || [];
        
        if (options.json) {
            console.log(formatToolsJson(tools));
        } else {
            console.log(formatToolsTable(tools));
        }
        
        socket.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(chalk.red(`Error listing tools: ${err.message}`));
        process.exit(1);
    }
  });

program
  .command('run <tool> [args...]')
  .description('Run a specific MCP tool')
  .option('-j, --json <json_args>', 'Pass arguments as JSON string')
  .action(async (toolName, args, options) => {
    const config = loadConfig();
    try {
        let toolArgs: any = {};
        
        if (options.json) {
            try {
                toolArgs = JSON.parse(options.json);
            } catch (e) {
                console.error(chalk.red('Invalid JSON arguments'));
                process.exit(1);
            }
        } else if (args && args.length > 0) {
             args.forEach((arg: string) => {
                const parts = arg.split('=');
                const key = parts[0];
                const value = parts.slice(1).join('=');
                if (key && value) {
                    toolArgs[key] = value;
                }
            });
        }

        const socket = await connectToServer(config);
        const client = new McpCliClient(socket);
        await client.initialize();
        
        const result = await client.callTool(toolName, toolArgs);
        
        // Format result nicely
        if (typeof result === 'object') {
             console.log(JSON.stringify(result, null, 2));
        } else {
             console.log(result);
        }
        
        socket.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(chalk.red(`Error running tool: ${err.message}`));
        process.exit(1);
    }
  });

program.parse(process.argv);