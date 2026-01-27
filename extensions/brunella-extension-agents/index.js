import fs from 'fs';
import path from 'path';

const registryPath = path.join(process.cwd(), 'src', 'agents', 'registry.json');

function loadRegistry() {
  if (!fs.existsSync(registryPath)) {
    console.log('registry.json nem található:', registryPath);
    return null;
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

export const extension = {
  name: 'agents',
  version: '0.1.0',
  description: 'Ügynök-regiszter parancsok (list, show).',
  async activate(context) {
    const { program } = context;
    if (!program) return;

    const cmd = program.command('agents').description('Ügynök-regiszter parancsok');

    cmd
      .command('list')
      .description('registry.json ügynökök listázása')
      .action(() => {
        const reg = loadRegistry();
        if (!reg || !reg.agents) return;
        reg.agents.forEach((a) => {
          console.log(`- ${a.name} (${a.title ?? ''}) [${a.status ?? 'n/a'}]`);
        });
      });

    cmd
      .command('show <name>')
      .description('Ügynök részletei név alapján')
      .action((name) => {
        const reg = loadRegistry();
        if (!reg || !reg.agents) return;
        const agent = reg.agents.find((a) => a.name === name);
        if (!agent) {
          console.log('Nincs ilyen ügynök:', name);
          return;
        }
        console.log(JSON.stringify(agent, null, 2));
      });
  }
};

export default extension;
