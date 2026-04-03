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
  trustScore?: number;
  metadata?: Record<string, unknown>;
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

interface FederationEvidenceJournalEntry {
  timestamp: string;
  peerId: string | null;
  title: string;
  detail: string;
  outcome: 'allowed' | 'denied' | 'observed';
  keyId: string | null;
  evidenceSources: Array<'audit' | 'phoenix'>;
}

interface FederationPeerEvidenceSummary {
  peerId: string;
  trustState: string;
  currentKeyId: string | null;
  nextKeyId: string | null;
  rotationState: 'stable' | 'staged' | 'missing' | 'revoked';
  lastEvidenceAt: string | null;
  latestAction: string | null;
  stageCount: number;
  promoteCount: number;
  revokeCount: number;
}

interface FederationEvidenceSnapshot {
  timestamp: string;
  truncated: boolean;
  peers: FederationPeerEvidenceSummary[];
  journal: FederationEvidenceJournalEntry[];
  totals: {
    peerCount: number;
    trustedCount: number;
    pendingCount: number;
    revokedCount: number;
    peersWithNextKey: number;
    deniedCount: number;
    stageCount: number;
    promoteCount: number;
    revokeCount: number;
  };
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
            `Score: ${peer.trustScore ?? '-'}`,
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

async function stageRuntimeKey(): Promise<void> {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'peerId', message: 'Peer ID:' },
    { type: 'input', name: 'publicKey', message: 'Következő runtime public key (PEM):' },
    { type: 'input', name: 'keyId', message: 'Key ID (opcionális):' },
  ]);

  const spinner = ora('Next runtime kulcs stage-elése...').start();
  try {
    await apiFetch(`/api/v1/federation/peers/${encodeURIComponent(String(answers.peerId))}/runtime-keys/stage`, {
      method: 'POST',
      body: JSON.stringify({
        publicKey: String(answers.publicKey),
        keyId: String(answers.keyId || '').trim() || undefined,
      }),
    });
    spinner.succeed(chalk.green(`Next runtime kulcs stage-elve: ${answers.peerId}`));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    spinner.fail(chalk.red(`Hiba: ${message}`));
  }
}

async function promoteRuntimeKey(): Promise<void> {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'peerId', message: 'Peer ID:' },
    { type: 'input', name: 'reason', message: 'Promóció oka (opcionális):' },
  ]);

  const spinner = ora('Runtime key promóció...').start();
  try {
    await apiFetch(`/api/v1/federation/peers/${encodeURIComponent(String(answers.peerId))}/runtime-keys/promote`, {
      method: 'POST',
      body: JSON.stringify({
        reason: String(answers.reason || '').trim() || undefined,
      }),
    });
    spinner.succeed(chalk.green(`Runtime kulcs promotálva: ${answers.peerId}`));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    spinner.fail(chalk.red(`Hiba: ${message}`));
  }
}

function formatEvidenceOutcome(outcome: FederationEvidenceJournalEntry['outcome']): string {
  if (outcome === 'allowed') {
    return 'ALLOWED';
  }

  if (outcome === 'denied') {
    return 'DENIED';
  }

  return 'OBSERVED';
}

function formatEvidenceSources(sources: FederationEvidenceJournalEntry['evidenceSources']): string {
  return sources.join('+');
}

async function listEvidence(): Promise<void> {
  const spinner = ora('Federation evidence betöltése...').start();
  try {
    const data = await apiFetch<FederationEvidenceSnapshot>('/api/v1/federation/evidence');
    spinner.stop();

    writeLine(
      boxen(
        [
          `Peer-ek: ${data.totals.peerCount} | trusted: ${data.totals.trustedCount} | pending: ${data.totals.pendingCount} | revoked: ${data.totals.revokedCount}`,
          `Key rollout: staged peers=${data.totals.peersWithNextKey} | stage=${data.totals.stageCount} | promote=${data.totals.promoteCount}`,
          `Operator outcome: denied=${data.totals.deniedCount} | revoke=${data.totals.revokeCount}`,
        ].join('\n'),
        {
          title: 'Federation Evidence',
          padding: 1,
        },
      ),
    );

    writeLine(chalk.bold('\nPeer rollout állapotok:'));
    writeLine(
      data.peers.length === 0
        ? 'Nincs federation evidence.'
        : data.peers
            .map((peer) =>
              [
                `Peer: ${peer.peerId}`,
                `Állapot: ${peer.trustState}`,
                `Rotation: ${peer.rotationState}`,
                `Current: ${peer.currentKeyId ?? '-'}`,
                `Next: ${peer.nextKeyId ?? '-'}`,
                `Utolsó művelet: ${peer.latestAction ?? '-'}`,
              ].join(' | '),
            )
            .join('\n'),
    );

    writeLine(chalk.bold('\nOperator journal:'));
    writeLine(
      data.journal.length === 0
        ? 'Nincs naplózott federation művelet.'
        : data.journal
            .map((entry) =>
              [
                `${new Date(entry.timestamp).toLocaleString()}`,
                formatEvidenceOutcome(entry.outcome),
                entry.title,
                `Peer: ${entry.peerId ?? '-'}`,
                entry.keyId ? `Key: ${entry.keyId}` : null,
                `Forrás: ${formatEvidenceSources(entry.evidenceSources)}`,
                entry.detail,
              ]
                .filter((value): value is string => Boolean(value))
                .join(' | '),
            )
            .join('\n'),
    );

    if (data.truncated) {
      writeLine('\nA journal rövidített; további evidence elérhető az API-n keresztül.');
    }
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
          { name: 'Next runtime kulcs stage-elése', value: 'stage_runtime_key' },
          { name: 'Next runtime kulcs promotálása', value: 'promote_runtime_key' },
          { name: 'Operator evidence áttekintése', value: 'evidence' },
          { name: 'Tárgyalások áttekintése', value: 'list_negotiations' },
          { name: 'Saját manifest megtekintése', value: 'show_local' },
          { name: 'Kilépés', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') return;
    if (action === 'list_peers') await listPeers();
    if (action === 'register_peer') await registerPeer();
    if (action === 'stage_runtime_key') await stageRuntimeKey();
    if (action === 'promote_runtime_key') await promoteRuntimeKey();
    if (action === 'evidence') await listEvidence();
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

  fed
    .command('evidence')
    .description('Operator evidence és runtime key rollout journal megjelenítése')
    .action(listEvidence);

  fed
    .command('stage-runtime-key')
    .description('Next runtime kulcs stage-elése egy federált partnerhez')
    .action(stageRuntimeKey);

  fed
    .command('promote-runtime-key')
    .description('Stage-elt next runtime kulcs promotálása current állapotba')
    .action(promoteRuntimeKey);
}
