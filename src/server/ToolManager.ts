import { getRegisteredToolsList, executeLocalTool } from './registry.js';

export class ToolManager {
    getToolDefinitions() {
        return getRegisteredToolsList();
    }

    async executeTool(name: string, args: any) {
        try {
            return await executeLocalTool(name, args);
        } catch (e: any) {
            console.error(`ToolManager execution error for ${name}:`, e.message);
            throw e;
        }
    }
}

export const toolManager = new ToolManager();