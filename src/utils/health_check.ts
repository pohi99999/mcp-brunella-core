import { config } from '../config/index.js';
import fs from 'fs/promises';
import path from 'path';

export async function checkSystemHealth(): Promise<string> {
    const status = {
        timestamp: new Date().toISOString(),
        workspace: config.workspaceRoot,
        nodeVersion: process.version,
        status: 'OK'
    };
    
    // Logolás - feltételezzük, hogy a könyvtár létezik
    const logPath = path.join(config.systemLogDir, 'health_status.json');
    try {
        await fs.writeFile(logPath, JSON.stringify(status, null, 2));
    } catch (e) {
        return JSON.stringify({ ...status, status: 'ERROR_WRITING_LOG' });
    }
    
    return JSON.stringify(status);
}
