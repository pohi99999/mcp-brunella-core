// src/core/mcpToolHook.ts
// Minden MCP tool hívás előtt/után fut — Golden Dataset audit
import { fireHook } from './agentHookEngine.js';
import { logError } from '../utils/logger.js';

/**
 * MCP eszköz hívás becsomagolása (wrapping) életciklus hookokkal.
 */
type ToolHandler<TArgs = unknown, TResult = unknown> = (args: TArgs) => Promise<TResult> | TResult;

export function wrapToolWithHooks<TArgs = unknown, TResult = unknown>(
  toolName: string,
  handler: ToolHandler<TArgs, TResult>,
) {
  return async (args: TArgs): Promise<TResult> => {
    const start = Date.now();
    
    // 1. Tool hívás előtti hook
    try {
      await fireHook('tool:before', { 
        agentName: toolName, 
        task: JSON.stringify(args) 
      });
    } catch (e) {
      logError('MCPToolHook', `Before hook error [${toolName}]: ${e}`);
    }

    try {
      // 2. Tényleges eszköz végrehajtás
      const result = await handler(args);
      
      const durationMs = Date.now() - start;

      // 3. Tool hívás utáni hook (Sikeres)
      await fireHook('tool:after', {
        agentName: toolName,
        task: JSON.stringify(args),
        result,
        durationMs
      });

      return result;
    } catch (error) {
      // 4. Hiba hook
      await fireHook('tool:error', { 
        agentName: toolName, 
        task: JSON.stringify(args), 
        error: error as Error 
      });
      throw error;
    }
  };
}
