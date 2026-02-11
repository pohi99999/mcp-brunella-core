/**
 * Tracks CLI Commands (Magyar)
 *
 * EPP v2 Protocol: Track management commands
 *
 * Parancsok:
 *  - brunella tracks generate  # Interaktív track generálás
 *  - brunella tracks list      # Tracks listázása
 *  - brunella tracks view <id> # Track megtekintés
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { logInfo, logError } from '../utils/logger.js';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

marked.setOptions({ renderer: new TerminalRenderer() as any });

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

/**
 * Fetch helper for tracks API
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1/tracks${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  if (!text) throw new Error(`Empty response from ${path}`);

  const data = JSON.parse(text) as T;

  if (!response.ok) {
    throw new Error((data as Record<string, string>).error || `HTTP ${response.status}`);
  }

  return data;
}

/**
 * Register tracks commands
 */
export function registerTracksCommands(program: Command) {
  const tracks = program.command('tracks').description('Track management commands (EPP v2)');

  // brunella tracks generate (interaktív)
  tracks
    .command('generate')
    .description('Új track generálása kreatív ötletből (interaktív)')
    .action(async () => {
      console.log(chalk.blue('\n🎨 Track Generátor - EPP v2\n'));

      // Interaktív idea input (inquirer.js)
      const answers = await inquirer.prompt([
        {
          type: 'editor',
          name: 'idea',
          message: 'Írd le az ötleted (2-5 mondat, magyarul is OK):',
          default: 'Példa: Dashboard TODO widget real-time sync-kal. WebSocket frissítés, checkbox toggle, track progress megjelenítés.',
        },
      ]);

      const { idea } = answers;

      if (!idea || idea.trim().length < 10) {
        console.log(chalk.red('\n❌ Túl rövid ötlet. Legalább 2-3 mondatot írj!'));
        return;
      }

      const spinner = ora('🔄 Track generálása folyamatban...').start();

      try {
        spinner.text = '📊 Stage 1/3: Követelmények kinyerése...';
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Artificial delay for UX

        spinner.text = '📝 Stage 2/3: Track írása...';
        await new Promise((resolve) => setTimeout(resolve, 1000));

        spinner.text = '✔️ Stage 3/3: Validálás...';

        const result = await apiFetch<{ success: boolean; trackId: string; preview: string }>('/generate', {
          method: 'POST',
          body: JSON.stringify({ idea }),
        });

        spinner.succeed(chalk.green(`✨ Track generálva: ${result.trackId}`));

        console.log(chalk.dim('\n📄 Előnézet:\n'));
        console.log(chalk.gray(result.preview));

        // Következő lépés menü
        const next = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Mit szeretnél csinálni?',
            choices: [
              { name: '📖 Track megtekintése (teljes)', value: 'view' },
              { name: '📋 Tracks listázása', value: 'list' },
              { name: '🏠 Vissza a főmenübe', value: 'exit' },
            ],
          },
        ]);

        if (next.action === 'view') {
          // View track command
          await viewTrackAction(result.trackId);
        } else if (next.action === 'list') {
          // List tracks command
          await listTracksAction();
        }
      } catch (e: any) {
        spinner.fail(chalk.red(`❌ Hiba történt: ${e.message}`));
        logError('CLI', `Track generation failed: ${e.message}`);
      }
    });

  // brunella tracks list
  tracks
    .command('list')
    .description('Összes track listázása')
    .action(async () => {
      await listTracksAction();
    });

  // brunella tracks view <trackId>
  tracks
    .command('view <trackId>')
    .description('Track részletek megtekintése')
    .argument('<trackId>', 'Track azonosító (pl: track-name-20260211)')
    .action(async (trackId: string) => {
      await viewTrackAction(trackId);
    });
}

/**
 * List all tracks (helper)
 */
async function listTracksAction() {
  console.log(chalk.blue('\n📋 Tracks listája\n'));
  const spinner = ora('Tracks betöltése...').start();

  try {
    const result = await apiFetch<{ success: boolean; count: number; tracks: any[] }>('/');
    spinner.stop();

    if (result.count === 0) {
      console.log(chalk.yellow('\n⚠️ Nincs track a rendszerben.'));
      return;
    }

    console.table(
      result.tracks.map((t: any) => ({
        ID: t.id,
        Title: t.title || 'N/A',
        Priority: t.priority || 'P2',
        Progress: `${t.progress || 0}%`,
      }))
    );

    console.log(chalk.dim(`\nÖsszesen: ${result.count} track\n`));
  } catch (e: any) {
    spinner.fail(chalk.red(`❌ Hiba: ${e.message}`));
    logError('CLI', `List tracks failed: ${e.message}`);
  }
}

/**
 * View specific track (helper)
 */
async function viewTrackAction(trackId: string) {
  console.log(chalk.blue(`\n📖 Track részletek: ${trackId}\n`));
  const spinner = ora('Track betöltése...').start();

  try {
    const result = await apiFetch<{ success: boolean; content: string; metadata: any }>(`/${trackId}`);
    spinner.stop();

    console.log(chalk.green(`\n✅ ${result.metadata.title}\n`));
    console.log(chalk.dim(`Priority: ${result.metadata.priority} | Progress: ${result.metadata.progress}%\n`));

    // Render markdown content
    console.log(marked(result.content));
  } catch (e: any) {
    spinner.fail(chalk.red(`❌ Hiba: ${e.message}`));
    logError('CLI', `View track failed: ${e.message}`);
  }
}
