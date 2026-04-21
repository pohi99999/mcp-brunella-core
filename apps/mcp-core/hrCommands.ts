import { Command } from 'commander';

export function getOrCreateHrCommand(program: Command): Command {
  const existing = program.commands.find((command) => command.name() === 'hr');
  if (existing) {
    return existing;
  }

  return program.command('hr').description('HR automatizálás parancsok');
}
