import { logInfo } from '../utils/logger.js';

export class McpProcessManager {
    startServer(name: string) { 
        logInfo('MCP', `[Stub] Start server ${name}`); 
    }
    stopServer(name: string) { 
        logInfo('MCP', `[Stub] Stop server ${name}`); 
    }
    getServersStatus() { 
        return []; 
    }
}

export const mcpProcessManager = new McpProcessManager();
