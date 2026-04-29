import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const executeSkillMock = vi.fn();
const connectMock = vi.fn();
const closeMock = vi.fn();

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    executeSkill: executeSkillMock,
  },
}));

vi.mock('@packages/utils/mcpClient.js', () => ({
  BrunellaClient: class {
    connect = connectMock;
    close = closeMock;
    callTool = vi.fn();
    listTools = vi.fn();
  },
}));

vi.mock('@apps/mcp-core/commands/invoiceSync.js', () => ({
  runInvoiceSync: vi.fn(),
}));

vi.mock('@apps/mcp-core/commands/commands/innovate-hu.js', () => ({
  innovateCommand: vi.fn(),
}));

vi.mock('@apps/mcp-core/commands/commands/hr-onboarding-hu.js', () => ({
  hrOnboardingCommand: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
    Separator: class Separator {},
  },
}));

describe('cli-hu skill commands', () => {
  beforeEach(() => {
    vi.resetModules();
    executeSkillMock.mockReset();
    connectMock.mockReset();
    closeMock.mockReset();
    connectMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes skill list command without connecting to MCP client', async () => {
    const originalArgv = process.argv;
    vi.stubGlobal('process', { ...process, argv: ['node', 'cli-hu.js', 'skill', 'lista'] } as NodeJS.Process);

    const module = await import('@packages/utils/cli-hu.js');
    const handled = await module.runSkillCommand(['skill', 'lista']);
    expect(handled).toBe(true);
    expect(connectMock).not.toHaveBeenCalled();
    expect(executeSkillMock).not.toHaveBeenCalled();

    vi.stubGlobal('process', { ...process, argv: originalArgv } as NodeJS.Process);
  });

  it('processes skill execute command with JSON params', async () => {
    const originalArgv = process.argv;
    executeSkillMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('process', { ...process, argv: ['node', 'cli-hu.js', 'skill', 'futtat', 'lead-hunter', '{"query":"b2b"}'] } as NodeJS.Process);

    const module = await import('@packages/utils/cli-hu.js');
    const handled = await module.runSkillCommand(['skill', 'futtat', 'lead-hunter', '{"query":"b2b"}']);
    expect(handled).toBe(true);
    expect(executeSkillMock).toHaveBeenCalledWith('lead-hunter', { query: 'b2b' });
    expect(connectMock).not.toHaveBeenCalled();

    vi.stubGlobal('process', { ...process, argv: originalArgv } as NodeJS.Process);
  });
});
