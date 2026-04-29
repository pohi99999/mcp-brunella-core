import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

vi.mock('@apps/mcp-core/server/toolRegistry.js', () => ({
  getAllToolDefinitions: vi.fn(),
  executeLocalTool: vi.fn(),
}));

vi.mock('@packages/utils/toolPermissions.js', () => ({
  checkToolPermission: vi.fn(),
}));

import { GitHubModelsAgent } from '@packages/agents/GitHubModelsAgent.js';
import type { ToolDefinition } from '@packages/agents/types.js';
import * as toolRegistry from '@apps/mcp-core/server/toolRegistry.js';
import * as toolPermissions from '@packages/utils/toolPermissions.js';

const originalFetch = global.fetch;
const originalGhToken = process.env.GH_TOKEN;
const originalGithubToken = process.env.GITHUB_TOKEN;
const originalGithubPat = process.env.GITHUB_PAT;

describe('GitHubModelsAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.GH_TOKEN = 'test-gh-token';
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PAT;

    global.fetch = vi.fn() as typeof fetch;

    vi.mocked(toolRegistry.getAllToolDefinitions).mockReturnValue([]);
    vi.mocked(toolRegistry.executeLocalTool).mockResolvedValue({ content: [] });
    vi.mocked(toolPermissions.checkToolPermission).mockReturnValue({
      allowed: true,
      reason: 'allowed',
    } as ReturnType<typeof toolPermissions.checkToolPermission>);
  });

  afterAll(() => {
    global.fetch = originalFetch;

    if (originalGhToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = originalGhToken;

    if (originalGithubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalGithubToken;

    if (originalGithubPat === undefined) delete process.env.GITHUB_PAT;
    else process.env.GITHUB_PAT = originalGithubPat;
  });

  it('should_return_response_when_api_succeeds_and_include_openai_tool_schema()', async () => {
    const explicitSchemaTool: ToolDefinition = {
      name: 'search_docs',
      description: 'Search documentation',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    };
    const fallbackSchemaTool: ToolDefinition = {
      name: 'ping_service',
      description: 'Ping external service',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'GitHub Models completed the task.',
            },
          },
        ],
      }),
    } as Response);

    const agent = new GitHubModelsAgent({
      mcpTools: [explicitSchemaTool, fallbackSchemaTool],
      systemPrompt: 'Test system prompt',
    });

    const result = await agent.execute('Summarize the repository state', {
      branch: 'main',
    });

    expect(result.status).toBe('success');
    expect(result.data).toEqual({
      response: 'GitHub Models completed the task.',
      model: 'gpt-4o',
      toolsUsed: 2,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((requestInit as RequestInit).body));

    expect(requestBody.messages).toEqual([
      { role: 'system', content: 'Test system prompt' },
      {
        role: 'system',
        content: 'Context:\n```json\n{\n  "branch": "main"\n}\n```',
      },
      { role: 'user', content: 'Summarize the repository state' },
    ]);
    expect(requestBody.tool_choice).toBe('auto');
    expect(requestBody.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'search_docs',
          description: 'Search documentation',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'ping_service',
          description: 'Ping external service',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      },
    ]);
  });

  it('should_autoload_allowed_tools_when_none_are_supplied_and_filter_disallowed_tools()', async () => {
    const allowedTool: ToolDefinition = {
      name: 'allowed_tool',
      description: 'Permitted tool',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    };
    const deniedTool: ToolDefinition = {
      name: 'denied_tool',
      description: 'Blocked tool',
    };

    vi.mocked(toolRegistry.getAllToolDefinitions).mockReturnValue([allowedTool, deniedTool]);
    vi.mocked(toolPermissions.checkToolPermission).mockImplementation((toolName: string) => {
      if (toolName === 'allowed_tool') {
        return { allowed: true, reason: 'allowed' } as ReturnType<typeof toolPermissions.checkToolPermission>;
      }
      return { allowed: false, reason: 'not approved for this agent' } as ReturnType<typeof toolPermissions.checkToolPermission>;
    });
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Autoloaded tools were available.',
            },
          },
        ],
      }),
    } as Response);

    const agent = new GitHubModelsAgent({ systemPrompt: 'Auto-load prompt' });

    const result = await agent.execute('Inspect repository');

    expect(result.status).toBe('success');
    expect(toolRegistry.getAllToolDefinitions).toHaveBeenCalledTimes(1);
    expect(toolPermissions.checkToolPermission).toHaveBeenCalledWith('allowed_tool', {
      agentName: 'GitHubModels',
    });
    expect(toolPermissions.checkToolPermission).toHaveBeenCalledWith('denied_tool', {
      agentName: 'GitHubModels',
    });
    expect((result.data as Record<string, unknown>).toolsUsed).toBe(1);

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((requestInit as RequestInit).body));

    expect(requestBody.tools).toHaveLength(1);
    expect(requestBody.tools[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'allowed_tool',
        description: 'Permitted tool',
      },
    });
  });

  it('should_return_friendly_rate_limit_error_when_github_models_replies_with_429()', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limit exceeded',
    } as Response);

    const agent = new GitHubModelsAgent();

    const result = await agent.execute('Trigger rate limit handling');

    expect(result.status).toBe('error');
    expect(result.error).toContain('GitHub Models API rate limit exceeded');
    expect(result.error).toContain('Ollama fallback');
  });

  it('should_terminate_tool_loop_when_tool_results_are_returned_and_model_finishes_response()', async () => {
    const tool: ToolDefinition = {
      name: 'lookup_repo',
      description: 'Look up repository data',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    };

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'tool-call-1',
                    type: 'function',
                    function: {
                      name: 'lookup_repo',
                      arguments: '{"query":"payments"}',
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Tool output incorporated into final answer.',
              },
            },
          ],
        }),
      } as Response);

    vi.mocked(toolRegistry.executeLocalTool).mockResolvedValueOnce({
      content: [{ type: 'text', text: 'local-tool-result' }],
    });

    const agent = new GitHubModelsAgent({ mcpTools: [tool] });

    const result = await agent.execute('Use the repository lookup tool');

    expect(result.status).toBe('success');
    expect((result.data as Record<string, unknown>).response).toBe(
      'Tool output incorporated into final answer.',
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(toolRegistry.executeLocalTool).toHaveBeenCalledWith(
      'lookup_repo',
      { query: 'payments' },
      {
        agentName: 'GitHubModels',
        metadata: { source: 'github-models' },
      },
    );

    const [, secondRequestInit] = vi.mocked(global.fetch).mock.calls[1];
    const secondRequestBody = JSON.parse(String((secondRequestInit as RequestInit).body));

    expect(secondRequestBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: [
            expect.objectContaining({
              id: 'tool-call-1',
            }),
          ],
        }),
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'tool-call-1',
          name: 'lookup_repo',
          content: 'local-tool-result',
        }),
      ]),
    );
  });
});
