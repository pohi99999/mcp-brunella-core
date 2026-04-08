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
import { ensureError } from '../utils/ensureError.js';
import { getTrackGroupLabel } from '../utils/trackGroups.js';
import { writeLine } from '../utils/cliOutput.js';

marked.setOptions({ renderer: new TerminalRenderer() });

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
      writeLine(chalk.blue('\n🎨 Track Generátor - EPP v2\n'));

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
        writeLine(chalk.red('\n❌ Túl rövid ötlet. Legalább 2-3 mondatot írj!'));
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

        writeLine(chalk.dim('\n📄 Előnézet:\n'));
        writeLine(chalk.gray(result.preview));

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
      } catch (error: unknown) {
        const err = ensureError(error);
        spinner.fail(chalk.red(`❌ Hiba történt: ${err.message}`));
        logError('CLI', `Track generation failed: ${err.message}`);
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

  // brunella tracks progress <trackId>
  tracks
    .command('progress <trackId>')
    .description('Track TODO progress megtekintése')
    .argument('<trackId>', 'Track azonosító')
    .action(async (trackId: string) => {
      await viewProgressAction(trackId);
    });

  // brunella tracks todo <trackId>
  tracks
    .command('todo <trackId>')
    .description('Track TODO pipálása (interaktív)')
    .argument('<trackId>', 'Track azonosító')
    .action(async (trackId: string) => {
      await toggleTodoAction(trackId);
    });
}

/**
 * List all tracks (helper)
 */
async function listTracksAction() {
  writeLine(chalk.blue('\n📋 Tracks listája\n'));
  const spinner = ora('Tracks betöltése...').start();

  try {
    const result = await apiFetch<{ success: boolean; count: number; tracks: any[] }>('/');
    spinner.stop();

    if (result.count === 0) {
      writeLine(chalk.yellow('\n⚠️ Nincs track a rendszerben.'));
      return;
    }

    console.table(
      result.tracks.map((t: any) => ({
        ID: t.id,
        Title: t.title || 'N/A',
        Group: getTrackGroupLabel(t.group),
        Priority: t.priority || 'P2',
        Progress: `${t.progress || 0}%`,
      }))
    );

    writeLine(chalk.dim(`\nÖsszesen: ${result.count} track\n`));
  } catch (error: unknown) {
    const err = ensureError(error);
    spinner.fail(chalk.red(`❌ Hiba: ${err.message}`));
    logError('CLI', `List tracks failed: ${err.message}`);
  }
}

/**
 * View specific track (helper)
 */
async function viewTrackAction(trackId: string) {
  writeLine(chalk.blue(`\n📖 Track részletek: ${trackId}\n`));
  const spinner = ora('Track betöltése...').start();

  try {
    const result = await apiFetch<{ success: boolean; content: string; metadata: any }>(`/${trackId}`);
    spinner.stop();

    writeLine(chalk.green(`\n✅ ${result.metadata.title}\n`));
    writeLine(chalk.dim(`Group: ${getTrackGroupLabel(result.metadata.group)} | Priority: ${result.metadata.priority} | Progress: ${result.metadata.progress}%\n`));

    // Render markdown content
    writeLine(marked(result.content));
  } catch (error: unknown) {
    const err = ensureError(error);
    spinner.fail(chalk.red(`❌ Hiba: ${err.message}`));
    logError('CLI', `View track failed: ${err.message}`);
  }
}

/**
 * View track TODO progress (helper)
 */
async function viewProgressAction(trackId: string) {
  writeLine(chalk.blue(`\n📊 Track TODO Progress: ${trackId}\n`));
  const spinner = ora('TODO lista betöltése...').start();

  try {
    interface TodoItem {
      id: string;
      text: string;
      completed: boolean;
      lineNumber: number;
    }

    interface TodoView {
      trackId: string;
      trackTitle: string;
      status: string;
      todos: TodoItem[];
      progress: number;
    }

    const result = await apiFetch<TodoView>(`/${trackId}/todos`);
    spinner.stop();

    writeLine(chalk.green(`\n✅ ${result.trackTitle}\n`));
    writeLine(chalk.dim(`Status: ${result.status} | Progress: ${result.progress}%\n`));

    if (result.todos.length === 0) {
      writeLine(chalk.yellow('⚠️ Nincs TODO item ebben a track-ben.\n'));
      return;
    }

    // Render TODO checklist
    result.todos.forEach((todo, index) => {
      const checkbox = todo.completed ? chalk.green('✓') : chalk.gray('☐');
      const text = todo.completed ? chalk.dim(chalk.strikethrough(todo.text)) : chalk.white(todo.text);
      writeLine(`${checkbox} ${index + 1}. ${text}`);
    });

    const completedCount = result.todos.filter(t => t.completed).length;
    writeLine(chalk.dim(`\n${completedCount} / ${result.todos.length} kész\n`));

  } catch (error: unknown) {
    const err = ensureError(error);
    spinner.fail(chalk.red(`❌ Hiba: ${err.message}`));
    logError('CLI', `View progress failed: ${err.message}`);
  }
}

/**
 * Toggle TODO checkbox (interactive)
 */
async function toggleTodoAction(trackId: string) {
  writeLine(chalk.blue(`\n✓ TODO Pipálása: ${trackId}\n`));
  const spinner = ora('TODO lista betöltése...').start();

  try {
    interface TodoItem {
      id: string;
      text: string;
      completed: boolean;
      lineNumber: number;
    }

    interface TodoView {
      trackId: string;
      trackTitle: string;
      status: string;
      todos: TodoItem[];
      progress: number;
    }

    const result = await apiFetch<TodoView>(`/${trackId}/todos`);
    spinner.stop();

    if (result.todos.length === 0) {
      writeLine(chalk.yellow('⚠️ Nincs TODO item ebben a track-ben.\n'));
      return;
    }

    // Interactive TODO selector
    const choices = result.todos.map((todo, index) => ({
      name: `${todo.completed ? chalk.green('[✓]') : chalk.gray('[ ]')} ${todo.text}`,
      value: todo.id,
      short: `TODO ${index + 1}`,
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'todoId',
        message: 'Melyik TODO-t szeretnéd pipálni/megnyitni?',
        choices,
      },
    ]);

    const toggleSpinner = ora('TODO toggle folyamatban...').start();

    const updated = await apiFetch<TodoView>(`/${trackId}/todos/${answer.todoId}`, {
      method: 'PATCH',
    });

    toggleSpinner.succeed(chalk.green('✨ TODO frissítve!'));

    // Show updated progress
    const selectedTodo = updated.todos.find(t => t.id === answer.todoId);
    if (selectedTodo) {
      const status = selectedTodo.completed ? chalk.green('✓ Kész') : chalk.gray('☐ Nyitott');
      writeLine(chalk.dim(`\n${status}: ${selectedTodo.text}\n`));
    }

    writeLine(chalk.dim(`Progress: ${updated.progress}%\n`));

    // Ask if user wants to continue
    const next = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Szeretnél még egy TODO-t pipálni?',
        default: false,
      },
    ]);

    if (next.continue) {
      await toggleTodoAction(trackId);
    }

  } catch (error: unknown) {
    const err = ensureError(error);
    spinner.fail(chalk.red(`❌ Hiba: ${err.message}`));
    logError('CLI', `Toggle TODO failed: ${err.message}`);
  }
}
