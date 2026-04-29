import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { registerPalyazatCommands } from '@apps/mcp-core/palyazatCommands.js';
import { DEFAULT_GRANT_PROFILE, buildGrantTask } from '@packages/utils/grantFlow.js';

describe('Pályázat CLI commands', () => {
  it('registers the palyazat command group', () => {
    const program = new Command();
    registerPalyazatCommands(program);

    const palyazat = program.commands.find((command) => command.name() === 'palyazat');
    expect(palyazat).toBeDefined();
  });

  it('serializes the default Iszapfaló profile for GrantWatcherAgent', () => {
    const task = buildGrantTask(DEFAULT_GRANT_PROFILE, 'NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026');
    const parsed = JSON.parse(task) as Record<string, unknown>;

    expect(parsed.companyName).toBe('Iszapfaló Kft.');
    expect(parsed.teaorCode).toBe('7210');
    expect(parsed.employeeCount).toBe(1);
    expect(parsed.annualRevenue).toBe(165800000);
    expect(parsed.location).toBe('Pest');
    expect(String(parsed.projectDescription)).toMatch(/iszap/i);
    expect(parsed.grantId).toBe('NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026');
  });
});
