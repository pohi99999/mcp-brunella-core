import { execSync } from 'child_process';

function runCmd(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

export const extension = {
  name: 'jules',
  version: '0.1.0',
  description: 'Jules QA parancsok: smoke és alap szcenáriók futtatása.',
  async activate(context) {
    const { program } = context;
    if (!program) return;

    const cmd = program.command('jules').description('Jules QA parancsok');

    cmd
      .command('smoke')
      .description('npm run smoke futtatása')
      .action(() => runCmd('npm run smoke'));

    cmd
      .command('scenario <id>')
      .description('TEST_BOOK.md szcenárió futtatása (1-5)')
      .action((id) => {
        // Egyszerű kiosztás: 5 = smoke, 1-4 = npm test
        if (id === '5') {
          runCmd('npm run smoke');
        } else {
          runCmd('npm test');
        }
      });
  }
};

export default extension;
