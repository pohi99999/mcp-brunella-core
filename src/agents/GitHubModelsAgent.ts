// FILE: src/agents/GitHubModelsAgent.ts
// PURPOSE: GitHub Models API (GPT-4o) wrapper agent with MCP tool support
// CREATED: 2026-02-17

import { IAgent, AgentResponse, ToolDefinition } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';
// Static import is safe now because toolRegistry.js is clean (no Node dependencies)
import { getAllToolDefinitions, executeLocalTool } from '../server/toolRegistry.js';

export interface GitHubModelsConfig {
  model?: string; // Default: gpt-4o
  temperature?: number; // Default: 0.1
  maxTokens?: number; // Default: 8192
  mcpTools?: ToolDefinition[]; // Brunella MCP tools for function calling
  systemPrompt?: string;
}

/**
 * GitHubModelsAgent - Premium AI orchestrator using GitHub Models API (GPT-4o)
 *
 * Features:
 * - Ingyenes GPT-4o hozzáférés (GitHub PAT-tal)
 * - MCP tool integration (Brunella tools átadása function calling-ként)
 * - Rate limiting aware (15 req/min, 150/óra ingyenes tier)
 * - Conductor track-kompatibilis
 *
 * Usage:
 *   const agent = new GitHubModelsAgent({ model: 'gpt-4o', mcpTools });
 *   const result = await agent.execute('Implement marketing_swarm Phase 2', context);
 */
export class GitHubModelsAgent implements IAgent {
  name = 'GitHubModels';
  role = 'Premium Orchestrator/Coder';
  description = 'GitHub Models API (GPT-4o) alapú premium ügynök MCP tool támogatással';
  capabilities: string[] = [
    'code_generation',
    'code_review',
    'architecture_design',
    'orchestration',
    'reasoning'
  ];

  private config: Required<GitHubModelsConfig>;

  constructor(config: GitHubModelsConfig = {}) {
    this.config = {
      model: config.model || 'gpt-4o',
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens || 8192,
      mcpTools: config.mcpTools || [],
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt()
    };

    logInfo(this.name, `Initialized (model=${this.config.model}, tools=${this.config.mcpTools.length})`);
  }

  /**
   * Execute task with GitHub Models API (GPT-4o)
   *
   * @param task - Natural language task description
   * @param context - Optional context (conductor track, project state, etc.)
   * @returns AgentResponse with result or error
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      // Validate GitHub PAT
      const apiKey = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
      if (!apiKey) {
        return {
          status: 'error',
          error: 'GITHUB_TOKEN or GITHUB_PAT not configured in .env'
        };
      }

      // Auto-load tools if not provided
      if (this.config.mcpTools.length === 0) {
        const tools = getAllToolDefinitions();
        if (tools.length > 0) {
          this.setMcpTools(tools);
        }
      }

      // Build messages
      const messages = this.buildMessages(task, context);

      logInfo(this.name, `Executing task via GitHub Models API (${this.config.model})`);
      logInfo(this.name, `MCP tools available: ${this.config.mcpTools.length}`);

      // Call GitHub Models API via llm_client
      const response = await this.callGitHubModels(messages);

      logInfo(this.name, 'Task completed successfully');

      return {
        status: 'success',
        data: {
          response,
          model: this.config.model,
          toolsUsed: this.config.mcpTools.length
        }
      };

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Execution failed: ${error}`);

      // Rate limiting error?
      if (error.includes('429') || error.includes('rate limit')) {
        return {
          status: 'error',
          error: 'GitHub Models API rate limit exceeded (15 req/min, 150/óra). Várj néhány percet vagy használj Ollama fallback-et.'
        };
      }

      return { status: 'error', error };

    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Call GitHub Models API with OpenAI-compatible chat completions endpoint
   *
   * Supports function calling (MCP tools átadása)
   */
  private async callGitHubModels(messages: Array<{ role: string; content: string | null; tool_calls?: any[] }>): Promise<string> {
    const apiKey = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
    let currentMessages = [...messages];
    let iteration = 0;
    const MAX_ITERATIONS = 10;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Build request body
      const requestBody: Record<string, unknown> = {
        messages: currentMessages,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1.0
      };

      // Add MCP tools if available (function calling)
      if (this.config.mcpTools.length > 0) {
        requestBody.tools = this.convertMcpToolsToOpenAI(this.config.mcpTools);
        requestBody.tool_choice = 'auto'; // Let GPT decide when to use tools
      }

      logInfo(this.name, `Calling GitHub Models API (Iteration ${iteration})`);

      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub Models API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      // Add assistant response to history
      currentMessages.push(message);

      // Handle tool calls (if GPT wants to use MCP tools)
      if (message.tool_calls && message.tool_calls.length > 0) {
        logInfo(this.name, `GPT requested tool calls: ${message.tool_calls.length}`);

        for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const argumentsStr = toolCall.function.arguments;

            logInfo(this.name, `Executing tool: ${functionName}`);

            let resultContent: string;
            try {
              const args = JSON.parse(argumentsStr);
              const result = await executeLocalTool(functionName, args);

              // Format result for OpenAI
              // MCP tools usually return { content: [{ type: 'text', text: '...' }] }
              if (result && result.content && Array.isArray(result.content)) {
                 // Join all text parts
                 resultContent = result.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text || '')
                    .join('\n');

                 // If no text, check for other types or dump JSON
                 if (!resultContent && result.content.length > 0) {
                     resultContent = JSON.stringify(result.content);
                 }
              } else {
                 resultContent = typeof result === 'string' ? result : JSON.stringify(result);
              }
            } catch (e: any) {
              logError(this.name, `Tool execution failed (${functionName}): ${e.message}`);
              resultContent = `Error executing tool ${functionName}: ${e.message}`;
            }

            // Add tool result to messages
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: resultContent
            } as any);
        }

        // Loop continues...
      } else {
        // No tool calls, return final content
        return message.content || '';
      }
    }

    throw new Error(`Max iterations (${MAX_ITERATIONS}) reached in tool execution loop.`);
  }

  /**
   * Build chat messages from task + context
   */
  private buildMessages(task: string, context?: unknown): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: this.config.systemPrompt }
    ];

    // Add context if available
    if (context) {
      const contextStr = typeof context === 'string' ? context : JSON.stringify(context, null, 2);
      messages.push({
        role: 'system',
        content: `Context:\n\`\`\`json\n${contextStr}\n\`\`\``
      });
    }

    messages.push({ role: 'user', content: task });

    return messages;
  }

  /**
   * Convert Brunella MCP tools to OpenAI function calling format
   */
  private convertMcpToolsToOpenAI(mcpTools: ToolDefinition[]): unknown[] {
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  /**
   * Default system prompt for GitHub Models Agent
   */
  private getDefaultSystemPrompt(): string {
    return `You are the Brunella AI System's premium orchestrator agent, powered by GPT-4o via GitHub Models API.

**Your Role:**
- Act as a senior software architect and technical lead
- Coordinate complex multi-agent tasks using Brunella's MCP tools
- Follow the Conductor track system (tracks.md) for project management
- Write production-ready TypeScript (ESM) and Python code
- Prioritize code quality, testing, and maintainability

**Available Tools:**
You have access to Brunella's MCP tools for:
- File operations (read, write, edit)
- Git operations (commit, push, PR creation)
- Python execution (scripts, data processing)
- Browser automation (Playwright, Browser-Use)
- Vector search (LanceDB RAG)
- Project management (conductor tracks)

**Guidelines:**
- Always follow ESM conventions (.js imports in TypeScript)
- Use logger.ts (never console.log)
- Write tests for new features (Vitest)
- Follow defensive programming (null checks, error handling)
- Respect the Conductor track workflow
- Be concise and actionable in responses

**Current Project:** Brunella Agent System (multi-agent AI platform)
**Architecture:** Node.js (TypeScript) + Python (FastAPI) + Ollama/Gemini LLMs
**Version Control:** Git + GitHub
**Testing:** Vitest + Playwright E2E`;
  }

  /**
   * Set MCP tools dynamically (for runtime configuration)
   */
  setMcpTools(tools: ToolDefinition[]): void {
    this.config.mcpTools = tools;
    logInfo(this.name, `Updated MCP tools: ${tools.length}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): GitHubModelsConfig {
    return { ...this.config };
  }
}
