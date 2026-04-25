import { getRegisteredToolsList, executeLocalTool } from './registry.js';
import { type ToolExecutionContext } from '../tools/toolPermissions.js';
import { logError } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';

export class ToolManager {
    getToolDefinitions() {
        return getRegisteredToolsList();
    }

    async executeTool(name: string, args: any, context: ToolExecutionContext = {}) {
        try {
            return await executeLocalTool(name, args, context);
        } catch (error: unknown) {
            const err = ensureError(error);
            logError('ToolManager', `Execution error for ${name}: ${err.message}`);
            throw err;
        }
    }
}

export const toolManager = new ToolManager();
