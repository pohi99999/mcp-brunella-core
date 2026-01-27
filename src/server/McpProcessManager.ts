import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('mcp_process_manager.log');

export interface McpServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export interface McpServerStatus extends McpServerConfig {
    status: 'running' | 'stopped' | 'error';
    pid?: number;
    error?: string;
}

class McpProcessManager {
    private processes: Map<string, ChildProcess> = new Map();
    private configs: McpServerConfig[] = [];
    private configPath: string = path.join(process.cwd(), 'mcp_servers.json');

    constructor() {
        this.loadConfigs();
    }

    private loadConfigs() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                this.configs = JSON.parse(data);
            }
        } catch (e: any) {
            logger.log(`Failed to load MCP configs: ${e.message}`);
        }
    }

    public getServersStatus(): McpServerStatus[] {
        return this.configs.map(config => {
            const proc = this.processes.get(config.name);
            return {
                ...config,
                status: proc ? 'running' : 'stopped',
                pid: proc?.pid
            };
        });
    }

    public async startServer(name: string): Promise<void> {
        const config = this.configs.find(c => c.name === name);
        if (!config) throw new Error(`Server config not found: ${name}`);
        if (this.processes.has(name)) throw new Error(`Server already running: ${name}`);

        logger.log(`Starting MCP server: ${name} (${config.command})`);
        
        const proc = spawn(config.command, config.args, {
            env: { ...process.env, ...config.env },
            shell: true // Useful for npx on Windows
        });

        proc.stdout?.on('data', (data) => {
            logger.log(`[${name}] stdout: ${data}`);
        });

        proc.stderr?.on('data', (data) => {
            logger.log(`[${name}] stderr: ${data}`);
        });

        proc.on('close', (code) => {
            logger.log(`[${name}] process exited with code ${code}`);
            this.processes.delete(name);
        });

        proc.on('error', (err) => {
            logger.log(`[${name}] process error: ${err.message}`);
            this.processes.delete(name);
        });

        this.processes.set(name, proc);
    }

    public stopServer(name: string): void {
        const proc = this.processes.get(name);
        if (proc) {
            logger.log(`Stopping MCP server: ${name}`);
            proc.kill();
            this.processes.delete(name);
        }
    }

    public stopAll() {
        for (const name of this.processes.keys()) {
            this.stopServer(name);
        }
    }
}

export const mcpProcessManager = new McpProcessManager();
