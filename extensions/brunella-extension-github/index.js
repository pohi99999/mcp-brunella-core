import { execSync } from 'child_process';
import chalk from 'chalk';

function runGh(cmd) {
  try {
    const out = execSync(`gh ${cmd}`, { stdio: 'pipe', encoding: 'utf-8' });
    console.log(out.trim());
  } catch (e) {
    console.error(chalk.red(`gh hiba: ${e.message}`));
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
  }
}

export const extension = {
  name: 'github',
  version: '0.1.0',
  description: 'GitHub integráció: PR lista, checks, státusz (gh CLI kell).',
  async activate(context) {
    const { program } = context;
    if (!program) return;

    const cmd = program.command('github').description('GitHub parancsok (gh CLI szükséges, GITHUB_TOKEN ajánlott)');

    cmd
      .command('status')
      .description('Repo státusz (gh repo status)')
      .action(() => runGh('repo status'));

    cmd
      .command('prs')
      .description('Nyitott PR-ek rövid listája (gh pr list)')
      .action(() => runGh('pr list'));

    cmd
      .command('checks [pr]')
      .description('PR checks (gh pr checks <id|url>)')
      .action((pr) => {
        if (!pr) {
          console.log(chalk.yellow('Add meg a PR azonosítót vagy URL-t.'));
          return;
        }
        runGh(`pr checks ${pr}`);
      });

    cmd
      .command('open [pr]')
      .description('PR megnyitása böngészőben (gh pr view --web)')
      .action((pr) => {
        if (pr) {
          runGh(`pr view ${pr} --web`);
        } else {
          console.log(chalk.yellow('Add meg a PR azonosítót vagy URL-t.'));
        }
      });
  }
};

export default extension;
