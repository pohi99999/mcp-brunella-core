// @ts-ignore
import io from "socket.io-client";
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { CONFIG_DIR, CliConfig } from './cli_config.js';

export class McpCliClient {
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

export async function startServer(): Promise<void> {
    console.log(chalk.yellow('Szerver indítása a háttérben...'));
    const serverPath = path.join(process.cwd(), 'build', 'index.js');
    
    // Ensure log dir exists
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

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

export async function connectToServer(config: CliConfig): Promise<any> {
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
