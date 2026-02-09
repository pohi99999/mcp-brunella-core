import { getRegisteredToolsList, executeLocalTool } from './registry.js';
import { logError } from '../utils/logger.js';

export class ToolManager {
    getToolDefinitions() {
        return getRegisteredToolsList();
    }

    async executeTool(name: string, args: any) {
        try {
            return await executeLocalTool(name, args);
        } catch (e: any) {
            logError('ToolManager', `Execution error for ${name}: ${e.message}`);
            throw e;
        }
    }
}

export const toolManager = new ToolManager();