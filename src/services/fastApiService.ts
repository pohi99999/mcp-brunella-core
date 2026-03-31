import type { ChildProcess } from 'child_process';
import { config } from '../config/index.js';
import { logInfo, logError } from '../utils/logger.js';
import { resolvePythonPath } from '../utils/pythonUtils.js';
import { killProcessOnPort } from '../utils/processUtils.js';
import { checkServerRunning } from '../utils/serverManager.js';

export class FastApiService {
    private child: ChildProcess | null = null;
    private readonly port = 8000;
    private isRestarting = false;

    async start(): Promise<void> {
        if (this.child && !this.child.killed) {
            logInfo('FastAPI', 'Service already managed by this process.');
            return;
        }

        const isRunning = await checkServerRunning(this.port);
        if (isRunning) {
            const isHealthy = await this.checkHealth();
            if (isHealthy) {
                logInfo('FastAPI', 'Service already running and healthy.');
                return;
            }
            logInfo('FastAPI', 'Port 8000 in use but service unhealthy. Killing process...');
            await killProcessOnPort(this.port);
            await new Promise(r => setTimeout(r, 1000));
        }

        const pythonPath = await resolvePythonPath(config.workspaceRoot);
        logInfo('FastAPI', `Starting service with ${pythonPath}...`);

        const { spawn } = await import('child_process');
        this.child = spawn(pythonPath, ['-m', 'myai.server'], {
            cwd: config.workspaceRoot,
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.child.stdout?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) logInfo('FastAPI', msg);
        });

        this.child.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) logError('FastAPI', msg);
        });

        this.child.on('close', (code: number | null) => {
            logInfo('FastAPI', `Process exited with code ${code}`);
            this.child = null;
        });

        let attempts = 0;
        while (attempts < 10) {
            await new Promise(r => setTimeout(r, 1000));
            if (await this.checkHealth()) {
                logInfo('FastAPI', 'Service started and healthy.');
                return;
            }
            attempts++;
        }
        logError('FastAPI', 'Service failed to start (health check timeout).');
    }

    async stop(): Promise<void> {
        if (this.child) {
            logInfo('FastAPI', 'Stopping managed process...');
            this.child.kill();
            this.child = null;
        }
        await killProcessOnPort(this.port);
    }

    async restart(): Promise<void> {
        if (this.isRestarting) return;
        this.isRestarting = true;
        try {
            logInfo('FastAPI', 'Restarting service...');
            await this.stop();
            await new Promise(r => setTimeout(r, 1000));
            await this.start();
        } finally {
            this.isRestarting = false;
        }
    }

    private async checkHealth(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`http://127.0.0.1:${this.port}/health`, { signal: controller.signal });
            clearTimeout(id);
            return res.ok;
        } catch {
            return false;
        }
    }
}

export const fastApiService = new FastApiService();
