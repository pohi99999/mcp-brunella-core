/**
 * Task CLI Commands
 *
 * `brunella task` command group for natural language task execution
 *
 * Commands:
 *  - brunella task <description>        # Execute task with natural language (Hungarian supported!)
 *  - brunella task interactive          # Interactive task menu
 *
 * @track cloudflare_workers_ai_20260221
 * @phase Natural Language Task Routing - CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ensureError } from '../utils/ensureError.js';
import { writeLine } from '../utils/cliOutput.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

/**
 * Fetch helper for CLI → REST API calls
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    const text = await response.text();
    if (!text) throw new Error(`Empty response from ${path}`);

    const data = JSON.parse(text) as T;

    if (!response.ok) {
        throw new Error((data as { error?: string }).error || `HTTP ${response.status}`);
    }

    return data;
}

/**
 * Format timestamp (human readable)
 */
function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('hu-HU');
}

interface TaskResultLike {
    status?: string;
    message?: string;
    data?: unknown;
}
function isTaskResultLike(v: unknown): v is TaskResultLike {
    return typeof v === 'object' && v !== null;
}

/**
 * Task result formatter (pretty print)
 */
function formatTaskResult(result: unknown): void {
    if (typeof result === 'string') {
        writeLine(chalk.cyan(`\n📋 Eredmény:\n`));
        writeLine(chalk.gray(`   ${result}`));
        return;
    }

    if (isTaskResultLike(result) && result.status) {
        writeLine(chalk.cyan(`\n📋 Eredmény:\n`));
        writeLine(chalk.gray(`   Státusz: ${result.status}`));
        if (result.message) writeLine(chalk.gray(`   Üzenet: ${result.message}`));
        if (result.data) {
            writeLine(chalk.gray(`   Adat: ${JSON.stringify(result.data, null, 2)}`));
        }
        return;
    }

    writeLine(chalk.cyan(`\n📋 Eredmény:\n`));
    writeLine(chalk.gray(JSON.stringify(result, null, 2)));
}

export function registerTaskCommands(program: Command) {
    const task = program
        .command('task')
        .description('Természetes nyelvű feladat végrehajtás (magyar nyelven is!)');

    /**
     * brunella task <description>
     * Execute task with natural language
     */
    task
        .argument('[description...]', 'Feladat leírása magyarul (pl. "Keress rá az AI hírekre")')
        .description('Természetes nyelvű feladat végrehajtás')
        .option('-c, --context <json>', 'További kontextus JSON formátumban')
        .option('-i, --interactive', 'Interaktív mód')
        .action(async (descriptionArgs: string[], options: { interactive?: boolean; context?: string }) => {
            // If no args or --interactive flag, start interactive mode
            if (descriptionArgs.length === 0 || options.interactive) {
                await startInteractiveTaskMode();
                return;
            }

            const description = descriptionArgs.join(' ');
            const spinner = ora(`Feladat végrehajtása: "${description}"`).start();

            try {
                let context: Record<string, unknown> = {};

                if (options.context) {
                    try {
                        context = JSON.parse(options.context);
                    } catch (error: unknown) {
                        const err = ensureError(error);
                        spinner.fail(chalk.red(`Érvénytelen JSON kontextus: ${err.message}`));
                        process.exit(1);
                    }
                }

                const result = await apiFetch<{
                    status: string;
                    result: unknown;
                    executedAt: string;
                }>('/api/enterprise/execute', {
                    method: 'POST',
                    body: JSON.stringify({
                        task: description,
                        context,
                    }),
                });

                if (result.status === 'success') {
                    spinner.succeed(chalk.green('Feladat végrehajtva!'));
                    formatTaskResult(result.result);
                    writeLine(chalk.gray(`\n⏱️  Végrehajtva: ${formatTime(result.executedAt)}`));
                } else {
                    spinner.fail(chalk.red('Hiba történt'));
                    writeLine(chalk.red(`\n❌ Státusz: ${result.status}`));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(`\n❌ Hiba: ${err.message}`));
                process.exit(1);
            }
        });

    /**
     * brunella task interactive
     * Interactive task menu
     */
    task
        .command('interactive')
        .alias('i')
        .description('Interaktív feladat végrehajtás mód')
        .action(async () => {
            await startInteractiveTaskMode();
        });

    return task;
}

/**
 * Interactive task mode (menu-driven)
 */
async function startInteractiveTaskMode() {
    writeLine(chalk.cyan('\n🧠 Brunella - Természetes Nyelvű Feladat Végrehajtás\n'));
    writeLine(chalk.gray('   Magyar nyelven írj bármilyen feladatot!'));
    writeLine(chalk.gray('   Példák:'));
    writeLine(chalk.gray('     - "Keress rá az AI hírekre"'));
    writeLine(chalk.gray('     - "Készíts Python scriptet CSV elemzésre"'));
    writeLine(chalk.gray('     - "Ellenőrizd a projekt státuszát"\n'));
    writeLine(chalk.gray('   Kilépés: exit, quit, vagy Ctrl+C\n'));

    let running = true;

    while (running) {
        try {
            const { choice } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: 'Mit szeretnél csinálni?',
                    choices: [
                        { name: '✍️  Új feladat megadása', value: 'new' },
                        { name: '📋 Előre definiált feladatok', value: 'predefined' },
                        { name: '❌ Kilépés', value: 'exit' },
                    ],
                },
            ]);

            if (choice === 'exit') {
                writeLine(chalk.yellow('\n👋 Viszlát!'));
                running = false;
                break;
            }

            if (choice === 'new') {
                const { task } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'task',
                        message: 'Írd le a feladatot magyarul:',
                        validate: (input: string) => {
                            if (!input.trim()) {
                                return 'A feladat leírása nem lehet üres!';
                            }
                            return true;
                        },
                    },
                ]);

                await executeTask(task.trim());
            } else if (choice === 'predefined') {
                const { predefined } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'predefined',
                        message: 'Válassz egy feladatot:',
                        choices: [
                            {
                                name: '🔍 Projekt státusz ellenőrzése',
                                value: 'Ellenőrizd a projekt státuszát és add meg a track-ek összefoglalóját',
                            },
                            {
                                name: '📊 Tesztek futtatása',
                                value: 'Futtasd le az összes tesztet és készíts összefoglalót',
                            },
                            {
                                name: '🌐 Webes kutatás',
                                value: 'Keress rá az AI fejlesztések legfrissebb híreire',
                            },
                            {
                                name: '💻 Kód generálás',
                                value: 'Készíts Python scriptet CSV fájl beolvasására és elemzésére',
                            },
                            {
                                name: '🔙 Vissza', value: 'back',
                            },
                        ],
                    },
                ]);

                if (predefined !== 'back') {
                    await executeTask(predefined);
                }
            }
        } catch (error: unknown) {
            const err = ensureError(error);
            if (err.message?.includes('User force closed')) {
                writeLine(chalk.yellow('\n👋 Viszlát!'));
                running = false;
            } else {
                writeLine(chalk.red(`\n❌ Hiba: ${err.message}`));
            }
        }
    }
}

/**
 * Execute task helper
 */
async function executeTask(taskDescription: string) {
    const spinner = ora(`Feladat végrehajtása...`).start();

    try {
        const result = await apiFetch<{
            status: string;
            result: unknown;
            executedAt: string;
        }>('/api/enterprise/execute', {
            method: 'POST',
            body: JSON.stringify({
                task: taskDescription,
                context: {},
            }),
        });

        if (result.status === 'success') {
            spinner.succeed(chalk.green('Feladat végrehajtva!'));
            formatTaskResult(result.result);
            writeLine(chalk.gray(`\n⏱️  Végrehajtva: ${formatTime(result.executedAt)}`));

            // Pause for user to see result
            await inquirer.prompt([
                {
                    type: 'input',
                    name: 'continue',
                    message: chalk.gray('Nyomj Enter-t a folytatáshoz...'),
                },
            ]);
        } else {
            spinner.fail(chalk.red('Hiba történt'));
            writeLine(chalk.red(`\n❌ Státusz: ${result.status}`));
        }
    } catch (error: unknown) {
        const err = ensureError(error);
        spinner.fail(chalk.red('API hiba'));
        writeLine(chalk.red(`\n❌ Hiba: ${err.message}`));

        // Pause to let user see the error
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: chalk.gray('Nyomj Enter-t a folytatáshoz...'),
            },
        ]);
    }
}
