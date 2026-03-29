import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

async function listPeers(): Promise<void> {
  const spinner = ora('Peer-ek lekérése...').start();
  try {
    const data = await apiFetch<{ peers: any[] }>('/api/v1/federation/peers');
    spinner.stop();
    console.log(chalk.bold(`
Federált Partnerek (${data.peers.length}):`));
    console.table(data.peers.map(p => ({
      ID: p.peerId,
      Név: p.displayName,
      Endpoint: p.endpoint,
      Állapot: p.trustState,
      Score: p.trustScore
    })));
  } catch (e: any) {
    spinner.fail(chalk.red(`Hiba: ${e.message}`));
  }
}

async function registerPeer(): Promise<void> {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'peerId', message: 'Peer ID:' },
    { type: 'input', name: 'displayName', message: 'Megjelenítési név:' },
    { type: 'input', name: 'endpoint', message: 'Endpoint URL:' },
  ]);

  const spinner = ora('Regisztráció...').start();
  try {
    const peer = await apiFetch('/api/v1/federation/peers/register', {
      method: 'POST',
      body: JSON.stringify(answers)
    });
    spinner.succeed(chalk.green(`Peer regisztrálva: ${answers.peerId}`));
  } catch (e: any) {
    spinner.fail(chalk.red(`Hiba: ${e.message}`));
  }
}

async function listNegotiations(): Promise<void> {
  const spinner = ora('Tárgyalások lekérése...').start();
  try {
    const data = await apiFetch<{ sessions: any[] }>('/api/v1/federation/negotiations');
    spinner.stop();
    console.log(chalk.bold(`
Aktív Tárgyalások (${data.sessions.length}):`));
    console.table(data.sessions.map(s => ({
      ID: s.sessionId.slice(0, 8),
      Partner: s.peerId,
      Állapot: s.state,
      Képességek: s.initialOffer.capabilities.join(', '),
      Frissítve: new Date(s.updatedAt).toLocaleString()
    })));
  } catch (e: any) {
    spinner.fail(chalk.red(`Hiba: ${e.message}`));
  }
}

async function runInteractiveFederation(): Promise<void> {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Federated MCP — válassz műveletet',
        choices: [
          { name: 'Partnerek listázása', value: 'list_peers' },
          { name: 'Új partner regisztrálása', value: 'register_peer' },
          { name: 'Tárgyalások áttekintése', value: 'list_negotiations' },
          { name: 'Saját manifest megtekintése', value: 'show_local' },
          { name: 'Kilépés', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') return;
    if (action === 'list_peers') await listPeers();
    if (action === 'register_peer') await registerPeer();
    if (action === 'list_negotiations') await listNegotiations();
    if (action === 'show_local') {
        const manifest = await apiFetch<any>('/api/v1/federation/manifests/local');
        console.log(boxen(JSON.stringify(manifest, null, 2), { title: 'Local Manifest', padding: 1 }));
    }
  }
}

export function registerFederationCommands(program: Command): void {
  const fed = program.command('federation').alias('fed').description('Federated MCP management commands');

  fed
    .command('status')
    .description('Federáció állapota és partnerek')
    .action(async () => {
      if (!process.stdin.isTTY) {
        await listPeers();
        return;
      }
      await runInteractiveFederation();
    });

  fed
    .command('peers')
    .description('Partnerek listázása')
    .action(listPeers);

  fed
    .command('negotiations')
    .description('Tárgyalások listázása')
    .action(listNegotiations);
}
