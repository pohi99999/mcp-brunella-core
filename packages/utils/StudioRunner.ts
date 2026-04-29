import { spawn, ChildProcess } from 'child_process';
import { socketService } from '../agents/SocketService.js';
import { logInfo, logError } from './logger.js';
import { updateProjectStatus } from './db.js';
import path from 'path';

interface ProjectProcess {
    process: ChildProcess;
    port: number;
    logs: string[];
}

class StudioRunner {
    private activeProjects: Map<string, ProjectProcess> = new Map();
    private nextPort = 5200;

    async startProject(projectId: string, rootDir: string): Promise<string> {
        if (this.activeProjects.has(projectId)) {
            return `http://localhost:${this.activeProjects.get(projectId)!.port}`;
        }

        const port = this.nextPort++;
        logInfo('StudioRunner', `Starting project ${projectId} on port ${port}`);

        // 1. Check if node_modules exists, if not run npm install
        const nmPath = path.join(rootDir, 'node_modules');
        try {
            await import('fs/promises').then(fs => fs.access(nmPath));
        } catch {
            logInfo('StudioRunner', `Installing dependencies for ${projectId}...`);
            socketService.emit('studio:log', { projectId, line: 'INSTALLING node_modules... (This may take a minute)', type: 'stdout' });
            
            try {
                // Synchronous install for now to ensure modules are there
                spawn('npm', ['install'], { cwd: rootDir, shell: true, stdio: 'inherit' });
                // Note: using sync might block, but spawn with 'inherit' is for debug. 
                // Let's use a promise wrapper for spawn instead.
                await this.runCommand('npm', ['install'], rootDir, projectId);
            } catch (err: any) {
                logError('StudioRunner', `Install failed: ${err.message}`);
            }
        }
        
        const child = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
            cwd: rootDir,
            shell: true,
            env: { ...process.env, BROWSER: 'none' }
        });

        const projectProcess: ProjectProcess = {
            process: child,
            port,
            logs: []
        };

        this.activeProjects.set(projectId, projectProcess);

        child.stdout?.on('data', (data) => {
            const line = data.toString();
            projectProcess.logs.push(line);
            if (projectProcess.logs.length > 500) projectProcess.logs.shift();
            
            socketService.emit('studio:log', { projectId, line, type: 'stdout' });
            
            // Check if Vite is ready
            if (line.includes('Local:') || line.includes('ready in')) {
                updateProjectStatus(projectId, 'coding', `http://localhost:${port}`);
                socketService.emit('studio:ready', { projectId, url: `http://localhost:${port}` });
            }
        });

        child.stderr?.on('data', (data) => {
            const line = data.toString();
            projectProcess.logs.push(line);
            socketService.emit('studio:log', { projectId, line, type: 'stderr' });
        });

        child.on('close', (code) => {
            logInfo('StudioRunner', `Project ${projectId} stopped with code ${code}`);
            this.activeProjects.delete(projectId);
            updateProjectStatus(projectId, 'stopped');
            socketService.emit('studio:stopped', { projectId });
        });

        return `http://localhost:${port}`;
    }

    stopProject(projectId: string) {
        const project = this.activeProjects.get(projectId);
        if (project) {
            project.process.kill();
            this.activeProjects.delete(projectId);
        }
    }

    private runCommand(cmd: string, args: string[], cwd: string, projectId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, { cwd, shell: true });
            
            child.stdout?.on('data', (data) => {
                socketService.emit('studio:log', { projectId, line: data.toString(), type: 'stdout' });
            });

            child.stderr?.on('data', (data) => {
                socketService.emit('studio:log', { projectId, line: data.toString(), type: 'stderr' });
            });

            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`${cmd} failed with code ${code}`));
            });
        });
    }

    getLogs(projectId: string): string[] {
        return this.activeProjects.get(projectId)?.logs || [];
    }
}

export const studioRunner = new StudioRunner();
