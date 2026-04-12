import { Command } from 'commander';

export function registerPalyazatCommands(program: Command): void {
  program
    .command('palyazat')
    .description('📑 Iszapfaló pályázatfigyelő és előkészítő vezérlőpult')
    .action(async () => {
      const { palyazatCommand } = await import('./commands/palyazat-hu.js');
      await palyazatCommand();
    });
}
