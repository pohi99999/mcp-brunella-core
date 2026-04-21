import { Command } from 'commander';

import { getOrCreateHrCommand } from './hrCommands.js';

export function registerHRTimesheetCommands(program: Command): void {
  const hr = getOrCreateHrCommand(program);
  const timesheet = hr.command('timesheet').description('HR timesheet és culture státusz');

  timesheet
    .command('status')
    .description('Read-only HR timesheet status snapshot')
    .option('--json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      const { hrTimesheetStatusCommand } = await import('./commands/hr-timesheet-hu.js');
      await hrTimesheetStatusCommand(opts.json ?? false);
    });
}
