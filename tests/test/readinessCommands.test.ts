import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { registerReadinessCommands } from '@apps/mcp-core/commands/readinessCommands.js';

const fetchMock = vi.fn();

const mcpServersResponse = {
  summary: { configured: 2, running: 1 },
  servers: [
    { name: 'brunella-core', status: 'running', transport: 'self', autoStart: true },
    { name: 'github', status: 'error', transport: 'stdio', error: 'Missing token' },
  ],
};

const mcpManifestResponse = {
  summary: { total: 3, ready: 1, blocked: 1, actionRequired: 1, inactive: 1, disabled: 1, unsupportedPlatform: 0, missingEnv: 1 },
  entries: [
    { name: 'brunella-core', canStart: true, readinessState: 'ready', blockers: [], actionableBlockers: [] },
    {
      name: 'github',
      canStart: false,
      readinessState: 'action_required',
      blockers: ['missing required env: GITHUB_PERSONAL_ACCESS_TOKEN'],
      actionableBlockers: ['missing required env: GITHUB_PERSONAL_ACCESS_TOKEN'],
    },
    {
      name: 'vscode-placeholder',
      canStart: false,
      readinessState: 'disabled',
      disabled: true,
      blockers: ['disabled in mcp_servers.json'],
      actionableBlockers: [],
      inactiveReason: 'Disabled intentionally in mcp_servers.json',
    },
  ],
};

const llmReadinessResponse = {
  summary: { status: 'partial', blockers: ['AnythingLLM workspace not found: brunella_main'] },
  primary: { label: 'GitHub Models', apiModel: 'openai/gpt-4.1', configured: true, tokenEnv: 'GITHUB_TOKEN' },
  fallback: { label: 'Ollama Local', model: 'gemma4:latest', configured: true, blockers: [] },
  anythingllm: {
    baseUrl: 'http://localhost:3001',
    apiKeyConfigured: true,
    workspace: { slug: 'brunella_main', available: false },
    blockers: ['AnythingLLM workspace not found: brunella_main'],
  },
};

const hookReadinessResponse = {
  success: true,
  readiness: {
    status: 'ready',
    blockers: [],
    summary: {
      registrySize: 12,
      registeredHandlers: 4,
      enabledHandlers: 4,
      disabledEvents: 0,
      audit: {
        total: 8,
        failed: 0,
        failureRate: 0,
      },
      circuitOpenCount: 0,
      dlqCount: 0,
    },
  },
};

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  registerReadinessCommands(program);
  return program;
}

describe('Readiness CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    process.env.BRUNELLA_API_URL = 'http://localhost:3000';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/v1/mcp/servers')) {
        return { ok: true, json: async () => mcpServersResponse };
      }
      if (url.endsWith('/api/v1/mcp/manifest')) {
        return { ok: true, json: async () => mcpManifestResponse };
      }
      if (url.endsWith('/api/v1/llm/orchestration-readiness')) {
        return { ok: true, json: async () => llmReadinessResponse };
      }
      if (url.endsWith('/api/v1/hooks/readiness')) {
        return { ok: true, json: async () => hookReadinessResponse };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    });
  });

  it('registers readiness subcommands', () => {
    const program = buildProgram();
    const readiness = program.commands.find((command) => command.name() === 'readiness');

    expect(readiness).toBeDefined();
    expect(readiness?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'mcp', 'llm', 'hooks']),
    );
  });

  it('renders combined readiness as JSON', async () => {
    const program = buildProgram();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'readiness', 'status', '--json']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    const parsed = JSON.parse(output);
    expect(parsed.mcpRuntime.summary.configured).toBe(2);
    expect(parsed.mcpManifest.summary.blocked).toBe(1);
    expect(parsed.mcpManifest.summary.inactive).toBe(1);
    expect(parsed.llm.primary.apiModel).toBe('openai/gpt-4.1');
    expect(parsed.hooks.readiness.status).toBe('ready');
  });

  it('renders human MCP readiness summary', async () => {
    const program = buildProgram();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'readiness', 'mcp']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('MCP readiness');
    expect(output).toContain('Runtime configured: 2');
    expect(output).toContain('Action required:');
    expect(output).toContain('Inactive planned:');
    expect(output).toContain('github: missing required env');
    expect(output).toContain('vscode-placeholder: Disabled intentionally');
  });

  it('renders human LLM readiness summary', async () => {
    const program = buildProgram();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'readiness', 'llm']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('LLM / AnythingLLM readiness');
    expect(output).toContain('openai/gpt-4.1');
    expect(output).toContain('gemma4:latest');
    expect(output).toContain('brunella_main');
  });

  it('renders human hook readiness summary', async () => {
    const program = buildProgram();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'readiness', 'hooks']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hook engine readiness');
    expect(output).toContain('READY');
    expect(output).toContain('Handlers:');
  });
});
