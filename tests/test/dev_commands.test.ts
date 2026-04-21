import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerDevCommands } from '../src/cli/devCommands.js';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn(),
}));

describe('Dev CLI Commands', () => {
    it('should register the "dev" command group', () => {
        const program = new Command();
        registerDevCommands(program);

        const devCmd = program.commands.find(c => c.name() === 'dev');
        expect(devCmd).toBeDefined();
        expect(devCmd!.description()).toContain('Developer');
    });

    it('should have all expected subcommands', () => {
        const program = new Command();
        registerDevCommands(program);

        const devCmd = program.commands.find(c => c.name() === 'dev')!;
        const subcommandNames = devCmd.commands.map(c => c.name());

        expect(subcommandNames).toContain('generate');
        expect(subcommandNames).toContain('test');
        expect(subcommandNames).toContain('fix');
        expect(subcommandNames).toContain('heal');
        expect(subcommandNames).toContain('review');
        expect(subcommandNames).toContain('status');
        expect(subcommandNames).toContain('history');
    });

    it('generate subcommand should accept variadic arguments', () => {
        const program = new Command();
        registerDevCommands(program);

        const devCmd = program.commands.find(c => c.name() === 'dev')!;
        const genCmd = devCmd.commands.find(c => c.name() === 'generate')!;

        // Commander variadic arg check
        expect(genCmd.registeredArguments.length).toBeGreaterThanOrEqual(1);
    });

    it('fix subcommand should have --auto option', () => {
        const program = new Command();
        registerDevCommands(program);

        const devCmd = program.commands.find(c => c.name() === 'dev')!;
        const fixCmd = devCmd.commands.find(c => c.name() === 'fix')!;

        const autoOpt = fixCmd.options.find(o => o.long === '--auto');
        expect(autoOpt).toBeDefined();
    });
});
