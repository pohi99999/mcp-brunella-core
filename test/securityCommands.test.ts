import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const securityHarness = vi.hoisted(() => ({
  listProfilesMock: vi.fn(),
  getViolationStatsMock: vi.fn(),
  getAgentProfileMock: vi.fn(),
  getViolationsMock: vi.fn(),
  getStatsMock: vi.fn(),
}));

vi.mock('../src/core/rbac/agentPermissions.js', () => ({
  getEnhancedPermissionManager: vi.fn(() => ({
    listProfiles: securityHarness.listProfilesMock,
    getViolationStats: securityHarness.getViolationStatsMock,
    getAgentProfile: securityHarness.getAgentProfileMock,
    getViolations: securityHarness.getViolationsMock,
  })),
}));

vi.mock('../src/core/sandbox/wasmSandbox.js', () => ({
  getSandboxPool: vi.fn(() => ({
    getStats: securityHarness.getStatsMock,
  })),
}));

import { registerSecurityCommands } from '../src/cli/securityCommands.js';

describe('Security CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    securityHarness.listProfilesMock.mockReset();
    securityHarness.getViolationStatsMock.mockReset();
    securityHarness.getAgentProfileMock.mockReset();
    securityHarness.getViolationsMock.mockReset();
    securityHarness.getStatsMock.mockReset();
  });

  it('should register the security command group with expected subcommands', () => {
    const program = new Command();
    registerSecurityCommands(program);

    const security = program.commands.find((command) => command.name() === 'security');
    expect(security).toBeDefined();
    expect(security?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['audit', 'permissions', 'sandbox', 'violations']),
    );
  });

  it('should render RBAC audit report to stdout', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.listProfilesMock.mockReturnValue([
      { name: 'Developer', role: 'developer', toolCount: 7, networkDomains: 3 },
      { name: 'Admin', role: 'admin', toolCount: -1, networkDomains: -1 },
    ]);
    securityHarness.getViolationStatsMock.mockReturnValue({
      total: 3,
      bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
      alertThresholdReached: true,
    });
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'security', 'audit']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('RBAC Audit Report');
    expect(output).toContain('Profilok:');
    expect(output).toContain('Developer');
    expect(output).toContain('Admin');
    expect(output).toContain('Sértés statisztika:');
    expect(output).toContain('FIGYELEM: Alert küszöb elérve');
  });

  it('should render permission profiles list to stdout', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.listProfilesMock.mockReturnValue([
      { name: 'DeveloperAgent', role: 'developer' },
      { name: 'ResearcherAgent', role: 'researcher' },
    ]);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'security', 'permissions']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Registered Permission Profiles');
    expect(output).toContain('DeveloperAgent — developer');
    expect(output).toContain('ResearcherAgent — researcher');
    expect(output).toContain('Használat: brunella security permissions <agent_name>');
  });

  it('should render specific agent profile to stdout', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.getAgentProfileMock.mockReturnValue({
      role: 'developer',
      permissions: ['read', 'write'],
      allowedTools: ['read_file', 'write_file'],
      allowedNetworkDomains: ['api.github.com'],
      codeExecAllowed: true,
      resourceLimits: {
        maxTokensPerCall: 4096,
        maxCostPerDay: 1.5,
      },
    });
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'security', 'permissions', 'DeveloperAgent']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('DeveloperAgent — Profil: developer');
    expect(output).toContain('Jogosultságok: read, write');
    expect(output).toContain('Eszközök: read_file, write_file');
    expect(output).toContain('Hálózat: api.github.com');
    expect(output).toContain('Kód futtatás: igen');
  });

  it('should render sandbox statistics to stdout', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.getStatsMock.mockReturnValue({
      totalExecutions: 14,
      successfulExecutions: 11,
      timeouts: 1,
      oomErrors: 1,
      securityViolations: 1,
      avgDurationMs: 42,
      idleInstances: 2,
      poolSize: 3,
    });
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'security', 'sandbox']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Sandbox Statistics');
    expect(output).toContain('Futtatások:');
    expect(output).toContain('Sikeres:');
    expect(output).toContain('Pool:');
  });

  it('should render recent violations to stdout', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.getViolationsMock.mockReturnValue([
      {
        timestamp: '2026-04-01T20:00:00.000Z',
        severity: 'high',
        agent: 'DeveloperAgent',
        action: 'tool:rm',
        reason: 'Blocked destructive tool',
      },
    ]);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'security', 'violations', '--limit', '5']);

    expect(securityHarness.getViolationsMock).toHaveBeenCalledWith(5);
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Utolsó 1 sértés');
    expect(output).toContain('DeveloperAgent');
    expect(output).toContain('tool:rm');
    expect(output).toContain('Blocked destructive tool');
  });

  it('should render failures to stderr and exit', async () => {
    const program = new Command();
    registerSecurityCommands(program);

    securityHarness.listProfilesMock.mockImplementation(() => {
      throw new Error('RBAC unavailable');
    });
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(program.parseAsync(['node', 'test', 'security', 'audit'])).rejects.toThrow('process.exit');

    const output = consoleErrSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Hiba: RBAC unavailable');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
