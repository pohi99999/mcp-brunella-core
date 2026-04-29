import { beforeEach, describe, expect, it, vi } from 'vitest';

// -----------------------------------------------------------------------
// Hoist mocks
// -----------------------------------------------------------------------
const { auditRecordMock } = vi.hoisted(() => ({
  auditRecordMock: vi.fn().mockResolvedValue(undefined),
}));

const { safeZoneValidateMock } = vi.hoisted(() => ({
  safeZoneValidateMock: vi.fn().mockReturnValue(true),
}));

vi.mock('@packages/core-logic/auditLog.js', () => ({
  record: auditRecordMock,
}));

vi.mock('@packages/core-logic/safe_zone_validator.js', () => ({
  getSafeZoneValidator: () => ({
    validate: safeZoneValidateMock,
  }),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('EphemeralSandbox', () => {
  beforeEach(() => {
    auditRecordMock.mockClear();
    safeZoneValidateMock.mockClear();
    safeZoneValidateMock.mockReturnValue(true);
  });

  it('allows a tool that is in the allowed list', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkToolAccess(['read_file', 'parse_csv'], {
      agentId: 'agent-001',
      toolName: 'read_file',
      parentAgentName: 'OrchestratorAgent',
    });

    expect(verdict.allowed).toBe(true);
    expect(verdict.scope).toBe('tool');
    expect(auditRecordMock).not.toHaveBeenCalled();
  });

  it('blocks a tool not in the allowed list and records DENIED', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkToolAccess(['read_file'], {
      agentId: 'agent-002',
      toolName: 'delete_file',
      parentAgentName: 'OrchestratorAgent',
    });

    expect(verdict.allowed).toBe(false);
  expect(verdict.scope).toBe('tool');
    expect(verdict.reason).toContain('delete_file');
    expect(auditRecordMock).toHaveBeenCalledWith(
      'DENIED',
      expect.stringContaining('agent-002'),
      expect.stringContaining('delete_file'),
      'delete_file',
      expect.any(String),
    );
  });

  it('publishes a phoenix:ephemeral_tool_violation event on violation', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');
    const { phoenixEventBus } = await import('@packages/core-logic/phoenixEventBus.js');
    phoenixEventBus.clearHistory();

    ephemeralSandbox.checkToolAccess(['tool_a'], {
      agentId: 'agent-003',
      toolName: 'tool_b',
      parentAgentName: 'ParentAgent',
    });

    const history = phoenixEventBus.getHistory('phoenix:ephemeral_tool_violation', 5);
    expect(history.length).toBeGreaterThan(0);

    const event = history[0]?.data as { toolName?: string; agentId?: string };
    expect(event?.toolName).toBe('tool_b');
    expect(event?.agentId).toBe('agent-003');
  });

  it('allows a call when the allowed list is empty only for tools explicitly listed', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const emptyVerdict = ephemeralSandbox.checkToolAccess([], {
      agentId: 'agent-004',
      toolName: 'any_tool',
      parentAgentName: 'P',
    });
    expect(emptyVerdict.allowed).toBe(false);
    expect(emptyVerdict.scope).toBe('tool');

    const exactVerdict = ephemeralSandbox.checkToolAccess(['any_tool'], {
      agentId: 'agent-005',
      toolName: 'any_tool',
      parentAgentName: 'P',
    });
    expect(exactVerdict.allowed).toBe(true);
    expect(exactVerdict.scope).toBe('tool');
  });

  it('blocks file access outside allowed paths', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkFileAccess(['f:\\workspace\\allowed'], {
      agentId: 'agent-006',
      parentAgentName: 'ParentAgent',
      filePath: 'f:\\workspace\\other\\secret.txt',
      operation: 'read',
      toolName: 'read_file',
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.scope).toBe('file');
    expect(verdict.reason).toContain('outside ephemeral allowedPaths');
  });

  it('allows file access inside assigned scope when safe zone passes', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkFileAccess(['f:\\workspace\\allowed'], {
      agentId: 'agent-007',
      parentAgentName: 'ParentAgent',
      filePath: 'f:\\workspace\\allowed\\notes.txt',
      operation: 'read',
      toolName: 'read_file',
    });

    expect(verdict.allowed).toBe(true);
    expect(verdict.scope).toBe('file');
    expect(safeZoneValidateMock).toHaveBeenCalled();
  });

  it('blocks network access outside assigned hosts', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkNetworkAccess(['api.example.com'], {
      agentId: 'agent-008',
      parentAgentName: 'ParentAgent',
      url: 'https://evil.example.net/path',
      toolName: 'fetch_webpage',
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.scope).toBe('network');
    expect(verdict.reason).toContain('Network access denied');
  });

  it('blocks composed chains that include disallowed tools', async () => {
    vi.resetModules();
    const { ephemeralSandbox } = await import('@packages/core-logic/ephemeralSandbox.js');

    const verdict = ephemeralSandbox.checkToolComposition(['tool_a'], {
      agentId: 'agent-009',
      parentAgentName: 'ParentAgent',
      chainId: 'chain-alpha',
      stepToolNames: ['tool_a', 'tool_b'],
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.scope).toBe('composition');
    expect(verdict.reason).toContain('tool_b');
  });
});
