/**
 * SystemController - Biztonságos szolgáltatás indítás/leállítás
 * Csak előre definiált parancsokat futtat (whitelist).
 * Mission Control 2.0 - Service Control Widget backend
 */

import type { ChildProcess } from 'child_process';
import path from 'path';
import { logInfo, logError } from '../utils/logger.js';
import { checkOllamaHealth } from '../utils/health.js';

export type ServiceId = 'ollama' | 'anythingllm' | 'python';

export type ServiceStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'unknown';

export interface ServiceState {
  id: ServiceId;
  status: ServiceStatus;
  pid?: number;
  lastCheck?: string;
  error?: string;
}

export interface ServiceHealthResult {
  ollama: boolean;
  python: boolean;
  anythingllm: boolean;
}

const ALLOWED_SERVICES: Record<ServiceId, { startCmd: string[]; cwd?: string; checkPort?: number }> = {
  ollama: {
    startCmd: ['ollama', 'serve'],
    checkPort: 11434,
  },
  anythingllm: {
    startCmd: [], // Desktop app - path from env
    checkPort: 3001,
  },
  python: {
    startCmd: process.platform === 'win32'
      ? ['python', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8000']
      : ['python', '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8000'],
    cwd: path.join(process.cwd(), 'myai'),
    checkPort: 8000,
  },
};

const spawnedProcesses = new Map<ServiceId, ChildProcess>();

export class SystemController {
  private static instance: SystemController;

  static getInstance(): SystemController {
    if (!SystemController.instance) {
      SystemController.instance = new SystemController();
    }
    return SystemController.instance;
  }

  async startService(serviceId: ServiceId): Promise<{ success: boolean; message: string }> {
    if (spawnedProcesses.has(serviceId)) {
      return { success: false, message: `${serviceId} már fut` };
    }

    if (typeof process === 'undefined' || !process.versions?.node) {
       return { success: false, message: 'SystemController not supported in this environment' };
    }

    const { spawn } = await import('child_process');
    const config = ALLOWED_SERVICES[serviceId];

    if (serviceId === 'anythingllm') {
      const exePath = process.env.ANYTHINGLLM_EXE_PATH;
      if (!exePath) {
        return {
          success: false,
          message: 'ANYTHINGLLM_EXE_PATH nincs beállítva a .env-ben',
        };
      }
      try {
        const child = spawn(exePath, [], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });
        child.unref();
        logInfo('SystemController', `AnythingLLM indítva: ${exePath}`);
        return { success: true, message: 'AnythingLLM indítva' };
      } catch (e: any) {
        logError('SystemController', `AnythingLLM indítás hiba: ${e.message}`);
        return { success: false, message: e.message };
      }
    }

    if (serviceId === 'ollama') {
      try {
        const child = spawn(config.startCmd[0], config.startCmd.slice(1), {
          detached: true,
          stdio: 'ignore',
          shell: process.platform === 'win32',
        });
        child.unref();
        spawnedProcesses.set(serviceId, child);
        logInfo('SystemController', 'Ollama indítva');
        return { success: true, message: 'Ollama indítva' };
      } catch (e: any) {
        logError('SystemController', `Ollama indítás hiba: ${e.message}`);
        return { success: false, message: e.message };
      }
    }

    if (serviceId === 'python') {
      try {
        const child = spawn(config.startCmd[0], config.startCmd.slice(1), {
          cwd: config.cwd || process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        });
        spawnedProcesses.set(serviceId, child);
        child.on('exit', (code) => {
          spawnedProcesses.delete(serviceId);
          logInfo('SystemController', `Python subsystem kilépett: ${code}`);
        });
        child.stderr?.on('data', (d) => console.error('[Python]', d.toString()));
        logInfo('SystemController', 'Python subsystem indítva (myai/server.py)');
        return { success: true, message: 'Python subsystem indítva' };
      } catch (e: any) {
        logError('SystemController', `Python indítás hiba: ${e.message}`);
        return { success: false, message: e.message };
      }
    }

    return { success: false, message: 'Ismeretlen szolgáltatás' };
  }

  async stopService(serviceId: ServiceId): Promise<{ success: boolean; message: string }> {
    if (typeof process === 'undefined' || !process.versions?.node) {
        return { success: false, message: 'SystemController not supported in this environment' };
    }

    const { spawn } = await import('child_process');
    const child = spawnedProcesses.get(serviceId);
    if (child && child.pid) {
      try {
        process.kill(child.pid, 'SIGTERM');
        spawnedProcesses.delete(serviceId);
        logInfo('SystemController', `${serviceId} leállítva`);
        return { success: true, message: `${serviceId} leállítva` };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }

    if (serviceId === 'ollama') {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/IM', 'ollama.exe', '/F'], { stdio: 'ignore' });
        } else {
          spawn('pkill', ['ollama'], { stdio: 'ignore' });
        }
        return { success: true, message: 'Ollama leállítás parancs elküldve' };
      } catch {
        return { success: false, message: 'Ollama nem fut vagy nem állítható le' };
      }
    }

    return { success: false, message: `${serviceId} nem fut (nem indítottuk)` };
  }

  async getServiceStatus(serviceId: ServiceId): Promise<ServiceState> {
    const config = ALLOWED_SERVICES[serviceId];
    const child = spawnedProcesses.get(serviceId);

    if (serviceId === 'ollama') {
      const result = await checkOllamaHealth();
      return {
        id: 'ollama',
        status: result.status === 'healthy' ? 'online' : 'offline',
        lastCheck: new Date().toISOString(),
        error: result.error,
      };
    }

    if (serviceId === 'python' && config.checkPort) {
      try {
        const res = await fetch(`http://127.0.0.1:${config.checkPort}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        return {
          id: 'python',
          status: res.ok ? 'online' : 'offline',
          pid: child?.pid,
          lastCheck: new Date().toISOString(),
        };
      } catch {
        return {
          id: 'python',
          status: child ? 'starting' : 'offline',
          pid: child?.pid,
          lastCheck: new Date().toISOString(),
        };
      }
    }

    if (serviceId === 'anythingllm' && config.checkPort) {
      try {
        const apiKey = process.env.ANYTHINGLLM_API_KEY;
        const baseUrl = process.env.ANYTHINGLLM_BASE_URL || `http://localhost:${config.checkPort}`;
        const res = await fetch(`${baseUrl}/api/v1/workspaces`, {
          signal: AbortSignal.timeout(5000),
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        return {
          id: 'anythingllm',
          status: res.ok ? 'online' : 'offline',
          lastCheck: new Date().toISOString(),
        };
      } catch {
        return {
          id: 'anythingllm',
          status: 'offline',
          lastCheck: new Date().toISOString(),
        };
      }
    }

    return {
      id: serviceId,
      status: child ? 'online' : 'offline',
      pid: child?.pid,
      lastCheck: new Date().toISOString(),
    };
  }

  async getAllStatus(): Promise<ServiceState[]> {
    const results = await Promise.all([
      this.getServiceStatus('ollama'),
      this.getServiceStatus('python'),
      this.getServiceStatus('anythingllm'),
    ]);
    return results;
  }
}

export const systemController = SystemController.getInstance();
