import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

interface FederationPeer {
  peerId: string;
  displayName: string;
  endpoint: string;
  trustState: string;
  trustScore: number;
}

interface FederationNegotiationSession {
  sessionId: string;
  peerId: string;
  state: string;
  initialOffer: {
    capabilities: string[];
  };
  updatedAt: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

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
    const data = await apiFetch<{ peers: FederationPeer[] }>('/api/v1/federation/peers');
    spinner.stop();
    writeLine(chalk.bold(`\nFederált Partnerek (${data.peers.length}):`));
    writeLine(
      data.peers
        .map((peer) =>
          [
            `ID: ${peer.peerId}`,
            `Név: ${peer.displayName}`,
            `Endpoint: ${peer.endpoint}`,
            `Állapot: ${peer.trustState}`,
            `Score: ${peer.trustScore}`,
          ].join(' | '),
        )
        .join('\n'),
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    spinner.fail(chalk.red(`Hiba: ${message}`));
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
    await apiFetch('/api/v1/federation/peers/register', {
      method: 'POST',
      body: JSON.stringify(answers)
    });
    spinner.succeed(chalk.green(`Peer regisztrálva: ${answers.peerId}`));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    spinner.fail(chalk.red(`Hiba: ${message}`));
  }
}

async function listNegotiations(): Promise<void> {
  const spinner = ora('Tárgyalások lekérése...').start();
  try {
    const data = await apiFetch<{ sessions: FederationNegotiationSession[] }>('/api/v1/federation/negotiations');
    spinner.stop();
    writeLine(chalk.bold(`\nAktív Tárgyalások (${data.sessions.length}):`));
    writeLine(
      data.sessions
        .map((session) =>
          [
            `ID: ${session.sessionId.slice(0, 8)}`,
            `Partner: ${session.peerId}`,
            `Állapot: ${session.state}`,
            `Képességek: ${session.initialOffer.capabilities.join(', ')}`,
            `Frissítve: ${new Date(session.updatedAt).toLocaleString()}`,
          ].join(' | '),
        )
        .join('\n'),
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    spinner.fail(chalk.red(`Hiba: ${message}`));
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
        const manifest = await apiFetch<Record<string, unknown>>('/api/v1/federation/manifests/local');
        writeLine(boxen(JSON.stringify(manifest, null, 2), { title: 'Local Manifest', padding: 1 }));
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
