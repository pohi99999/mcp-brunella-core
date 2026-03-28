import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { Ollama } from 'ollama';
import type { ChatRequest, ChatResponse, Message, Tool as OllamaTool } from 'ollama';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import path from 'path';

export interface OllamaMCPConfig {
  ollamaBaseUrl?: string;
  mcpServerPath?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  maxTokens?: number;
  enableStreaming?: boolean;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface OllamaChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[]; // Tool names to make available
  stream?: boolean;
}

interface MCPToolResult {
  success?: boolean;
  error?: string;
  content?: string;
  items?: unknown[];
  matches?: string[];
  data?: unknown;
}

/**
 * Ollama MCP Client
 *
 * Integrates Ollama LLM with MCP filesystem tools.
 * Enables Ollama to perform secure file operations via MCP protocol.
 */
export class OllamaMCPClient {
  private mcpClient: Client | null = null;
  private ollama: Ollama;
  private config: Required<OllamaMCPConfig>;
  private mcpServerProcess: ChildProcess | null = null;
  private isConnected: boolean = false;

  constructor(config?: OllamaMCPConfig) {
    this.config = {
      ollamaBaseUrl: config?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      mcpServerPath: config?.mcpServerPath || path.resolve('dist/server/mcp_server.js'),
      defaultModel: config?.defaultModel || 'qwen2.5-coder:7b',
      defaultTemperature: config?.defaultTemperature ?? 0.7,
      maxTokens: config?.maxTokens || 4096,
      enableStreaming: config?.enableStreaming ?? false
    };

    this.ollama = new Ollama({ host: this.config.ollamaBaseUrl });
    logInfo('OllamaMCPClient', 'Client initialized');
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logWarn('OllamaMCPClient', 'Already connected to MCP server');
      return;
    }

    try {
      // Spawn MCP server process
      logInfo('OllamaMCPClient', `Starting MCP server: ${this.config.mcpServerPath}`);

      this.mcpServerProcess = spawn('node', [this.config.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle server process errors
      this.mcpServerProcess.on('error', (error) => {
        logError('OllamaMCPClient', `MCP server process error: ${error.message}`);
      });

      this.mcpServerProcess.stderr?.on('data', (data) => {
        logWarn('OllamaMCPClient', `MCP server stderr: ${data.toString()}`);
      });

      // Create MCP client with stdio transport
      const transport = new StdioClientTransport({
        command: 'node',
        args: [this.config.mcpServerPath]
      });

      this.mcpClient = new Client(
        {
          name: 'brunella-ollama-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.mcpClient.connect(transport);
      this.isConnected = true;

      logInfo('OllamaMCPClient', 'Connected to MCP server');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('OllamaMCPClient', `Failed to connect to MCP server: ${errorMsg}`);
      throw new Error(`MCP connection failed: ${errorMsg}`, { cause: error });
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      if (this.mcpClient) {
        await this.mcpClient.close();
        this.mcpClient = null;
      }

      if (this.mcpServerProcess) {
        this.mcpServerProcess.kill();
        this.mcpServerProcess = null;
      }

      this.isConnected = false;
      logInfo('OllamaMCPClient', 'Disconnected from MCP server');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('OllamaMCPClient', `Error during disconnect: ${errorMsg}`);
    }
  }

  /**
   * Get available MCP tools
   */
  async listTools(): Promise<OllamaTool[]> {
    if (!this.isConnected || !this.mcpClient) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const { tools } = await this.mcpClient.listTools();

      // Convert MCP tools to Ollama tool format
      const ollamaTools: OllamaTool[] = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema
        }
      }));

      logInfo('OllamaMCPClient', `Listed ${ollamaTools.length} MCP tools`);
      return ollamaTools;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('OllamaMCPClient', `Failed to list tools: ${errorMsg}`);
      throw new Error(`Failed to list tools: ${errorMsg}`, { cause: error });
    }
  }

  /**
   * Chat with Ollama using MCP tools
   */
  async chat(prompt: string, options?: OllamaChatOptions): Promise<ChatResponse> {
    if (!this.isConnected || !this.mcpClient) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    const model = options?.model || this.config.defaultModel;
    const temperature = options?.temperature ?? this.config.defaultTemperature;
    const maxTokens = options?.maxTokens || this.config.maxTokens;
    const stream = options?.stream ?? this.config.enableStreaming;

    try {
      // Get available MCP tools
      const allTools = await this.listTools();

      // Filter tools if specific tools requested
      const tools = options?.tools && options.tools.length > 0
        ? allTools.filter(t => t.function.name && options.tools!.includes(t.function.name))
        : allTools;

      logInfo('OllamaMCPClient', `Chat with model ${model}, ${tools.length} tools available`);

      // Initial chat request
      const messages: Message[] = [{ role: 'user', content: prompt }];

      // Initial chat request (non-streaming for tool calls)
      let response = await this.ollama.chat({
        model,
        messages,
        tools,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens
        }
      });

      // Handle tool calls (iterative refinement)
      let iterations = 0;
      const maxIterations = 5;

      while (response.message.tool_calls && iterations < maxIterations) {
        iterations++;
        logInfo('OllamaMCPClient', `Tool calls detected (iteration ${iterations})`);

        // Execute each tool call
        const toolResults = await Promise.all(
          response.message.tool_calls.map(async (toolCall: { function: { name: string; arguments: Record<string, unknown> } }) => {
            return await this.executeTool(toolCall.function.name, toolCall.function.arguments);
          })
        );

        // Add assistant message with tool calls
        messages.push(response.message);

        // Add tool results as messages
        toolResults.forEach((result: unknown) => {
          messages.push({
            role: 'tool',
            content: JSON.stringify(result)
          });
        });

        // Continue conversation with tool results
        response = await this.ollama.chat({
          model,
          messages,
          tools,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens
          }
        });
      }

      if (iterations >= maxIterations) {
        logWarn('OllamaMCPClient', 'Max tool call iterations reached');
      }

      logInfo('OllamaMCPClient', `Chat completed in ${iterations} iterations`);
      return response;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('OllamaMCPClient', `Chat failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Execute MCP tool
   */
  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    try {
      logInfo('OllamaMCPClient', `Executing tool: ${toolName}`);

      const result = await this.mcpClient.callTool({
        name: toolName,
        arguments: args
      });

      // Extract text content from result
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(c => c.type === 'text');
        if (textContent && 'text' in textContent) {
          try {
            // Try to parse JSON response
            return JSON.parse(textContent.text) as MCPToolResult;
          } catch {
            // Return raw text if not JSON
            return { success: true, data: textContent.text };
          }
        }
      }

      return result as MCPToolResult;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('OllamaMCPClient', `Tool execution failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Simple file read via MCP (convenience method)
   */
  async readFile(filePath: string): Promise<string> {
    const result = await this.executeTool('read_file', { path: filePath });

    if (!result.success) {
      throw new Error(`Failed to read file: ${result.error}`);
    }

    if (typeof result.content !== 'string') {
      throw new Error('Failed to read file: malformed MCP response');
    }

    return result.content;
  }

  /**
   * Simple file write via MCP (convenience method)
   */
  async writeFile(filePath: string, content: string): Promise<boolean> {
    const result = await this.executeTool('write_file', {
      path: filePath,
      content
    });

    if (!result.success) {
      throw new Error(`Failed to write file: ${result.error}`);
    }

    return true;
  }

  /**
   * List directory contents via MCP (convenience method)
   */
  async listDirectory(dirPath: string, includeHidden: boolean = false): Promise<unknown[]> {
    const result = await this.executeTool('list_directory', {
      path: dirPath,
      include_hidden: includeHidden
    });

    if (!result.success) {
      throw new Error(`Failed to list directory: ${result.error}`);
    }

    if (!Array.isArray(result.items)) {
      throw new Error('Failed to list directory: malformed MCP response');
    }

    return result.items;
  }

  /**
   * Search files via MCP (convenience method)
   */
  async searchFiles(pattern: string, directory?: string): Promise<string[]> {
    const result = await this.executeTool('search_files', {
      pattern,
      directory
    });

    if (!result.success) {
      throw new Error(`Failed to search files: ${result.error}`);
    }

    if (!Array.isArray(result.matches)) {
      throw new Error('Failed to search files: malformed MCP response');
    }

    return result.matches.filter((match): match is string => typeof match === 'string');
  }

  /**
   * Check if connected to MCP server
   */
  isConnectedToMCP(): boolean {
    return this.isConnected;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<OllamaMCPConfig> {
    return { ...this.config };
  }
}

/**
 * Singleton instance for easy access
 */
let clientInstance: OllamaMCPClient | null = null;

/**
 * Get or create OllamaMCPClient singleton
 */
export function getOllamaMCPClient(config?: OllamaMCPConfig): OllamaMCPClient {
  if (!clientInstance) {
    clientInstance = new OllamaMCPClient(config);
  }
  return clientInstance;
}

/**
 * Reset singleton (mainly for testing)
 */
export function resetOllamaMCPClient(): void {
  if (clientInstance) {
    clientInstance.disconnect().catch(() => {});
    clientInstance = null;
  }
}
