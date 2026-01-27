import { conductorCommand } from '../../src/cli/commands/conductor.js';

export const extension = {
  name: 'conductor',
  version: '0.1.0',
  description: 'Conductor parancsok: status/list/show/phase/task/run',
  async activate(context) {
    const { program } = context;
    if (!program) return;
    // Parancs regisztrálása
    program
      .command('conductor <action> [id] [phase] [task]')
      .description('Conductor track-ek kezelése')
      .action(conductorCommand);
  }
};

export default extension;
