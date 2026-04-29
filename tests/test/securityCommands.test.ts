import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerSecurityCommands } from '@apps/mcp-core/commands/securityCommands.js';

describe('Security CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register the security command', () => {
    const program = new Command();
    registerSecurityCommands(program);

    const security = program.commands.find((command) => command.name() === 'security');
    expect(security).toBeDefined();
    expect(security?.description()).toContain('Security Sandbox');
  });
});
