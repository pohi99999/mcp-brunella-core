import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerKkvFinanceCommands } from '@apps/mcp-core/commands/kkvFinanceCommands.js';

describe('KKV Finance CLI', () => {
  it('registers summarize command', () => {
    const program = new Command();
    registerKkvFinanceCommands(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('kkv-finance');
  });
});
