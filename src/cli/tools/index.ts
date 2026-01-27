import './fs_tools.js';
import './browser_tools.js';
import './search_tools.js';
import { toolRegistry } from './registry.js';
import type { Tool as LLMTool } from '../../core/llm_client.js';

const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true
};

export function getNativeToolsForLLM(): LLMTool[] {
  return toolRegistry.listTools().map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || DEFAULT_SCHEMA
    }
  }));
}

export { toolRegistry };
