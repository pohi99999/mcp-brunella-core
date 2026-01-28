export class McpProcessManager {
    startServer(name: string) { 
        console.log(`[Stub] Start server ${name}`); 
    }
    stopServer(name: string) { 
        console.log(`[Stub] Stop server ${name}`); 
    }
    getServersStatus() { 
        return []; 
    }
}

export const mcpProcessManager = new McpProcessManager();
