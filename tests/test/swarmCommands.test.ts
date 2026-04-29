import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerSwarmCommands } from '@apps/mcp-core/commands/swarmCommands.js';

describe('Swarm CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register the swarm command', () => {
    const program = new Command();
    registerSwarmCommands(program);

    const swarm = program.commands.find((command) => command.name() === 'swarm');
    expect(swarm).toBeDefined();
    expect(swarm?.description()).toContain('Swarm Orchestrator');
  });
});
