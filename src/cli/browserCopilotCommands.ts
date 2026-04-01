import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

type SessionMode = 'observe' | 'guide' | 'auto';
type EnginePreference = 'auto' | 'chrome-acp' | 'robotkez';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/browser-copilot${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T : {} as T;
  if (!response.ok) {
    const errorRecord = typeof data === 'object' && data !== null ? data as Record<string, unknown> : undefined;
    const message = typeof errorRecord?.error === 'string' ? errorRecord.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function printSession(session: Record<string, unknown>): void {
  const lines = [
    chalk.bold.cyan('\n🧭 Browser Copilot session\n'),
    `Állapot: ${chalk.green(String(session.status ?? 'n/a'))}`,
    `Mód: ${chalk.yellow(String(session.mode ?? 'n/a'))}`,
    `Viewport: ${chalk.magenta(String(session.viewportEngine ?? 'n/a'))}`,
    `Action engine: ${chalk.blue(String(session.actionEngine ?? 'n/a'))}`,
    `Chrome ACP: ${session.chromeAcpReachable ? chalk.green('elérhető') : chalk.gray('offline')}`,
    `Paused: ${session.paused ? chalk.red('igen') : chalk.green('nem')}`,
  ];

  if (typeof session.currentInstruction === 'string' && session.currentInstruction) {
    lines.push(`Aktuális instrukció: ${session.currentInstruction}`);
  }
  if (typeof session.pendingInstruction === 'string' && session.pendingInstruction) {
    lines.push(`Pending guide: ${session.pendingInstruction}`);
  }

  for (const line of lines) {
    writeLine(line);
  }
}

export function registerBrowserCopilotCommands(program: Command) {
  const root = program
    .command('browser-copilot')
    .alias('bc')
    .description('Chrome ACP + Robotkéz élő session coordinator kezelése');

  root
    .command('status')
    .description('A Browser Copilot session aktuális állapota')
    .action(async () => {
      const spinner = ora('Browser Copilot session lekérdezése...').start();
      try {
        const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/session');
        spinner.succeed('Session betöltve');
        printSession(result.session);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(message);
        process.exit(1);
      }
    });

  root
    .command('send')
    .argument('<instruction>', 'Magyar nyelvű browser copilot instrukció')
    .description('Instrukció küldése a közös Browser Copilot sessionnek')
    .action(async (instruction: string) => {
      const spinner = ora('Instrukció küldése...').start();
      try {
        const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/message', {
          method: 'POST',
          body: JSON.stringify({ instruction }),
        });
        spinner.succeed('Instrukció feldolgozva');
        printSession(result.session);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(message);
        process.exit(1);
      }
    });

  root
    .command('confirm')
    .description('Guide módban függő terv megerősítése és végrehajtása')
    .action(async () => {
      const spinner = ora('Guide feladat megerősítése...').start();
      try {
        const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/confirm', { method: 'POST' });
        spinner.succeed('Guide feladat kezelve');
        printSession(result.session);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(message);
        process.exit(1);
      }
    });

  root
    .command('pause')
    .description('Session szüneteltetése')
    .action(async () => {
      const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/pause', { method: 'POST' });
      printSession(result.session);
    });

  root
    .command('resume')
    .description('Session folytatása')
    .action(async () => {
      const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/resume', { method: 'POST' });
      printSession(result.session);
    });

  root
    .command('reset')
    .description('Új Browser Copilot session indítása')
    .action(async () => {
      const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/reset', { method: 'POST' });
      printSession(result.session);
    });

  root
    .command('configure')
    .description('Browser Copilot mód és viewport preference beállítása')
    .requiredOption('--mode <mode>', 'observe | guide | auto')
    .requiredOption('--engine <engine>', 'auto | chrome-acp | robotkez')
    .option('--overlay <overlay>', 'true | false', 'true')
    .action(async (options: { mode: SessionMode; engine: EnginePreference; overlay: string }) => {
      const overlayEnabled = options.overlay !== 'false';
      const result = await apiFetch<{ success: boolean; session: Record<string, unknown> }>('/session/configure', {
        method: 'POST',
        body: JSON.stringify({
          mode: options.mode,
          enginePreference: options.engine,
          overlayEnabled,
        }),
      });
      printSession(result.session);
    });
}
