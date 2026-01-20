import { config } from '../config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { getRAGCacheStats } from './rag.js';
import { Logger } from './logger.js';
const logger = new Logger('health_check.log');
export async function checkSystemHealth() {
    const errors = [];
    const status = {
        timestamp: new Date().toISOString(),
        status: 'OK',
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime()
        },
        workspace: {
            root: config.workspaceRoot,
            exists: false,
            accessible: false
        },
        logs: {
            directory: config.systemLogDir,
            exists: false,
            writable: false
        },
        services: {},
        cache: {
            rag: getRAGCacheStats()
        }
    };
    // Check workspace
    try {
        await fs.access(config.workspaceRoot);
        status.workspace.exists = true;
        status.workspace.accessible = true;
    }
    catch (error) {
        status.workspace.exists = false;
        status.workspace.accessible = false;
        errors.push(`Workspace not accessible: ${config.workspaceRoot}`);
        status.status = 'ERROR';
    }
    // Check logs directory
    try {
        await fs.access(config.systemLogDir);
        status.logs.exists = true;
        // Try to write a test file
        const testFile = path.join(config.systemLogDir, '.health_check_test');
        try {
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            status.logs.writable = true;
        }
        catch {
            status.logs.writable = false;
            errors.push('Logs directory is not writable');
            status.status = status.status === 'ERROR' ? 'ERROR' : 'WARN';
        }
    }
    catch (error) {
        status.logs.exists = false;
        status.logs.writable = false;
        errors.push(`Logs directory does not exist: ${config.systemLogDir}`);
        status.status = 'WARN';
    }
    // Check Ollama service
    try {
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        status.services.ollama = {
            reachable: response.ok,
            status: response.ok ? 'OK' : `HTTP ${response.status}`
        };
        if (!response.ok) {
            errors.push(`Ollama returned status ${response.status}`);
            status.status = status.status === 'ERROR' ? 'ERROR' : 'WARN';
        }
    }
    catch (error) {
        status.services.ollama = {
            reachable: false,
            status: error instanceof Error ? error.message : 'Connection failed'
        };
        errors.push('Ollama service is not reachable');
        status.status = status.status === 'ERROR' ? 'ERROR' : 'WARN';
    }
    // Check AnythingLLM service
    if (config.anythingllmBaseUrl) {
        try {
            const response = await fetch(`${config.anythingllmBaseUrl}/api/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            status.services.anythingllm = {
                reachable: response.ok,
                url: config.anythingllmBaseUrl
            };
            if (!response.ok) {
                errors.push(`AnythingLLM returned status ${response.status}`);
                status.status = status.status === 'ERROR' ? 'ERROR' : 'WARN';
            }
        }
        catch (error) {
            status.services.anythingllm = {
                reachable: false,
                url: config.anythingllmBaseUrl
            };
            errors.push('AnythingLLM service is not reachable');
            status.status = status.status === 'ERROR' ? 'ERROR' : 'WARN';
        }
    }
    if (errors.length > 0) {
        status.errors = errors;
    }
    // Write health status to file
    const logPath = path.join(config.systemLogDir, 'health_status.json');
    try {
        await fs.writeFile(logPath, JSON.stringify(status, null, 2));
        await logger.log('Health check completed', { status: status.status, errors: errors.length });
    }
    catch (e) {
        await logger.error('Failed to write health status', e instanceof Error ? e : undefined);
    }
    return status;
}
// Export function that returns JSON string for backward compatibility
export async function checkSystemHealthJSON() {
    const status = await checkSystemHealth();
    return JSON.stringify(status, null, 2);
}
