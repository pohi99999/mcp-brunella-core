/**
 * RobotkezV2 CLI Commands
 *
 * `brunella robotkez` command group for the RobotkezV2 Agent
 *
 * Commands:
 *  - brunella robotkez chat <instruction>       # Natural language browser automation
 *  - brunella robotkez plan <instruction>       # Preview execution plan
 *  - brunella robotkez exec --action <action>   # Direct browser action
 *  - brunella robotkez status                   # Agent & browser status
 *  - brunella robotkez screenshot               # Take screenshot
 *  - brunella robotkez tasks list               # List background tasks
 *  - brunella robotkez tasks status <id>        # Task status by ID
 *  - brunella robotkez tasks cancel <id>        # Cancel task
 *  - brunella robotkez interactive              # REPL mode
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 7 - CLI Commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ensureError } from '../utils/ensureError.js';
import { writeLine } from '../utils/cliOutput.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

/**
 * Fetch helper for CLI → REST API calls
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}/api/v1/robotkez${path}`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    const text = await response.text();
    if (!text) throw new Error(`Empty response from ${path}`);

    const data = JSON.parse(text) as T;

    if (!response.ok) {
        throw new Error((data as any).error || `HTTP ${response.status}`);
    }

    return data;
}

/**
 * Format timestamp (human readable)
 */
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('hu-HU');
}

/**
 * Format duration (ms → seconds)
 */
function formatDuration(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Status icon helper
 */
function getStatusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✅';
        case 'running': return '⏳';
        case 'error': return '❌';
        case 'cancelled': return '🚫';
        default: return '⚪';
    }
}

export function registerRobotkezCommands(program: Command) {
    const robotkez = program
        .command('robotkez')
        .alias('rk')
        .description('RobotkezV2 - Magyar Agentic Browser (Comet-style)');

    /**
     * brunella robotkez hybrid <instruction>
     * Direct Python hybrid engine execution (Playwright + Browser-Use)
     */
    robotkez
        .command('hybrid')
        .argument('<instruction>', 'Natural language instruction (e.g., "screenshot github.com")')
        .option('-m, --mode <mode>', 'Execution mode: auto, playwright, browser-use', 'auto')
        .option('--headless', 'Run in headless mode', true)
        .option('--url <url>', 'Target URL')
        .option('--screenshot <path>', 'Screenshot output path')
        .option('--pdf <path>', 'PDF output path')
        .description('Hybrid browser automation (Playwright + Browser-Use)')
        .action(async (instruction: string, options: any) => {
            const spinner = ora(`Executing: "${instruction}" (mode=${options.mode})`).start();

            try {
                // Import agent dynamically (avoid top-level import in CLI)
                const { RobotkezV2Agent } = await import('../agents/RobotkezV2Agent.js');
                const agent = new RobotkezV2Agent();

                // Build context
                const context: any = {
                    mode: options.mode,
                    headless: options.headless
                };
                if (options.url) context.url = options.url;
                if (options.screenshot) context.screenshot_path = options.screenshot;
                if (options.pdf) context.pdf_path = options.pdf;

                // Execute
                const result = await agent.execute(instruction, context);

                if (result.status === 'success') {
                    spinner.succeed(chalk.green('Success!'));
                    writeLine(chalk.cyan('\n📝 Result:'));
                    const data = result.data as any;
                    if (data?.mode) writeLine(chalk.gray(`   Mode: ${data.mode}`));
                    if (data?.duration_ms) writeLine(chalk.gray(`   Duration: ${data.duration_ms}ms`));
                    if (data?.screenshot_path) {
                        writeLine(chalk.green(`   Screenshot: ${data.screenshot_path}`));
                    }
                    if (result.message) {
                        writeLine(chalk.gray(`   ${result.message}`));
                    }
                } else {
                    spinner.fail(chalk.red('Failed'));
                    writeLine(chalk.red(`Error: ${result.error}`));
                    process.exit(1);
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('Execution error'));
                writeLine(chalk.red(err.message));
                if (err.stack) {
                    writeLine(chalk.gray(err.stack));
                }
                process.exit(1);
            }
        });

    /**
     * brunella robotkez chat <instruction>
     * Natural language browser automation
     */
    robotkez
        .command('chat')
        .argument('<instruction>', 'Magyar nyelvű utasítás (pl. "Navigálj a google.com-ra")')
        .description('Természetes nyelvű böngésző automatizálás')
        .action(async (instruction: string) => {
            const spinner = ora(`Feldolgozás: "${instruction}"`).start();

            try {
                const result = await apiFetch<{ success: boolean; message: string; data?: any }>('/chat', {
                    method: 'POST',
                    body: JSON.stringify({ instruction }),
                });

                if (result.success) {
                    spinner.succeed(chalk.green('Feladat végrehajtva!'));
                    writeLine(chalk.cyan('\n📝 Eredmény:'), result.message);

                    if (result.data?.taskId) {
                        writeLine(chalk.yellow('\n🔄 Háttérben fut...'));
                        writeLine(chalk.gray(`   Task ID: ${result.data.taskId}`));
                        writeLine(chalk.gray(`   Becsült idő: ${formatDuration(result.data.estimatedDuration || 0)}`));
                    }
                } else {
                    spinner.fail(chalk.red('Hiba történt'));
                    writeLine(chalk.red(result.message));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez plan <instruction>
     * Preview execution plan without executing
     */
    robotkez
        .command('plan')
        .argument('<instruction>', 'Magyar nyelvű utasítás')
        .description('Végrehajtási terv előnézete (nincs végrehajtás)')
        .action(async (instruction: string) => {
            const spinner = ora('Terv generálása...').start();

            try {
                const result = await apiFetch<{ success: boolean; plan: any; message: string }>('/plan', {
                    method: 'POST',
                    body: JSON.stringify({ instruction }),
                });

                if (result.success) {
                    spinner.succeed(chalk.green('Terv generálva!'));
                    writeLine(chalk.cyan(`\n📋 Lépések (${result.plan.plan.length}):
`));

                    result.plan.plan.forEach((step: any, i: number) => {
                        writeLine(chalk.gray(`   ${i + 1}. ${step.action}: ${step.description}`));
                    });

                    writeLine(chalk.yellow(`\n⏱️  Becsült idő: ${formatDuration(result.plan.estimatedDuration)}`));
                    writeLine(chalk.gray(`   Háttér jogosult: ${result.plan.backgroundEligible ? 'Igen' : 'Nem'}`));
                } else {
                    spinner.fail(chalk.red('Terv generálás sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez exec --action <action> [params]
     * Direct browser action execution
     */
    robotkez
        .command('exec')
        .description('Közvetlen böngésző művelet végrehajtása')
        .requiredOption('--action <action>', 'Művelet (navigate, click, type, screenshot, scroll, wait, extract)')
        .option('--url <url>', 'URL (navigate action-höz)')
        .option('--selector <selector>', 'CSS selector (click, type, wait, extract)')
        .option('--text <text>', 'Szöveg (type action-höz)')
        .option('--direction <direction>', 'Scroll irány (up, down, left, right)')
        .option('--amount <amount>', 'Scroll mennyiség (px)', parseInt)
        .option('--timeout <timeout>', 'Timeout (ms)', parseInt)
        .action(async (options: any) => {
            const spinner = ora(`Végrehajtás: ${options.action}`).start();

            try {
                const params: any = { action: options.action };
                if (options.url) params.url = options.url;
                if (options.selector) params.selector = options.selector;
                if (options.text) params.text = options.text;
                if (options.direction) params.direction = options.direction;
                if (options.amount) params.amount = options.amount;
                if (options.timeout) params.timeout = options.timeout;

                const result = await apiFetch<{ success: boolean; result: any; message: string }>('/exec', {
                    method: 'POST',
                    body: JSON.stringify(params),
                });

                if (result.success) {
                    spinner.succeed(chalk.green('Művelet végrehajtva!'));
                    writeLine(chalk.cyan(result.message));
                } else {
                    spinner.fail(chalk.red('Művelet sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez status
     * Show agent and browser status
     */
    robotkez
        .command('status')
        .description('Ügynök és böngésző státusz')
        .action(async () => {
            const spinner = ora('Státusz lekérése...').start();

            try {
                const result = await apiFetch<{
                    success: boolean;
                    agent: any;
                    browser: any;
                    tasks: any;
                }>('/status');

                spinner.stop();

                writeLine(chalk.cyan('\n🤖 Ügynök:'));
                writeLine(chalk.gray(`   Név: ${result.agent.name}`));
                writeLine(chalk.gray(`   Szerepkör: ${result.agent.role}`));
                writeLine(chalk.gray(`   Képességek: ${result.agent.capabilities.join(', ')}`));

                writeLine(chalk.cyan('\n🌐 Böngésző:'));
                writeLine(chalk.gray(`   Aktív: ${result.browser.active ? chalk.green('✅ Igen') : chalk.red('❌ Nem')}`));
                writeLine(chalk.gray(`   Motor: ${result.browser.engine}`));

                writeLine(chalk.cyan('\n📋 Feladatok:'));
                writeLine(chalk.gray(`   Összes: ${result.tasks.total}`));
                writeLine(chalk.gray(`   Futó: ${chalk.blue(result.tasks.running)}`));
                writeLine(chalk.gray(`   Befejezett: ${chalk.green(result.tasks.completed)}`));
                writeLine(chalk.gray(`   Hibák: ${chalk.red(result.tasks.error)}`));
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez screenshot
     * Take a screenshot (saves to file)
     */
    robotkez
        .command('screenshot')
        .option('-o, --output <path>', 'Output fájl név', `screenshot_${Date.now()}.png`)
        .description('Screenshot készítése')
        .action(async (options: { output: string }) => {
            const spinner = ora('Screenshot készítése...').start();

            try {
                const url = `${API_BASE}/api/v1/robotkez/screenshot?t=${Date.now()}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const buffer = await response.arrayBuffer();
                const outputPath = options.output.startsWith('/')
                    ? options.output
                    : join(process.cwd(), options.output);

                writeFileSync(outputPath, Buffer.from(buffer));

                spinner.succeed(chalk.green('Screenshot mentve!'));
                writeLine(chalk.cyan(`   📸 Fájl: ${outputPath}`));
                writeLine(chalk.gray(`   Méret: ${(buffer.byteLength / 1024).toFixed(1)} KB`));
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('Screenshot hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez tasks (subcommand group)
     */
    const tasks = robotkez
        .command('tasks')
        .description('Háttér feladatok kezelése');

    /**
     * brunella robotkez tasks list
     * List background tasks
     */
    tasks
        .command('list')
        .option('--status <status>', 'Szűrés státusz szerint (running, completed, error, cancelled)')
        .option('--limit <limit>', 'Max találatok száma', parseInt, 20)
        .description('Háttér feladatok listázása')
        .action(async (options: { status?: string; limit: number }) => {
            const spinner = ora('Feladatok lekérése...').start();

            try {
                const params = new URLSearchParams();
                if (options.status) params.set('status', options.status);
                if (options.limit) params.set('limit', String(options.limit));

                const result = await apiFetch<{ success: boolean; tasks: any[]; count: number }>(
                    `/tasks?${params.toString()}`
                );

                spinner.stop();

                if (result.tasks.length === 0) {
                    writeLine(chalk.yellow('\n📋 Nincsenek feladatok'));
                    return;
                }

                writeLine(chalk.cyan(`\n📋 Feladatok (${result.count}):\n`));

                result.tasks.forEach((task: any) => {
                    const icon = getStatusIcon(task.status);
                    writeLine(`${icon} ${chalk.bold(task.instruction.slice(0, 60))}${task.instruction.length > 60 ? '...' : ''}`);
                    writeLine(chalk.gray(`   ID: ${task.id}`));
                    writeLine(chalk.gray(`   Státusz: ${task.status} (${task.progress}%)`));
                    writeLine(chalk.gray(`   Indítva: ${formatTime(task.startedAt)}`));
                    if (task.error) {
                        writeLine(chalk.red(`   Hiba: ${task.error}`));
                    }
                    writeLine();
                });
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez tasks status <id>
     * Get task status by ID
     */
    tasks
        .command('status')
        .argument('<id>', 'Task ID')
        .description('Feladat státusz lekérése')
        .action(async (id: string) => {
            const spinner = ora(`Feladat lekérése: ${id}`).start();

            try {
                const result = await apiFetch<{ success: boolean; task: any }>(`/tasks/${id}`);

                spinner.stop();

                const task = result.task;
                const icon = getStatusIcon(task.status);

                writeLine(chalk.cyan(`\n${icon} Feladat Részletek:\n`));
                writeLine(chalk.gray(`   ID: ${task.id}`));
                writeLine(chalk.gray(`   Utasítás: ${task.instruction}`));
                writeLine(chalk.gray(`   Státusz: ${task.status}`));
                writeLine(chalk.gray(`   Progress: ${task.progress}%`));
                writeLine(chalk.gray(`   Indítva: ${formatTime(task.startedAt)}`));
                if (task.completedAt) {
                    writeLine(chalk.gray(`   Befejezve: ${formatTime(task.completedAt)}`));
                    writeLine(chalk.gray(`   Időtartam: ${formatDuration(task.completedAt - task.startedAt)}`));
                }

                writeLine(chalk.cyan(`\n📝 Lépések (${task.steps.length}):\n`));
                task.steps.forEach((step: any, i: number) => {
                    const stepIcon = getStatusIcon(step.status);
                    writeLine(`   ${stepIcon} ${step.description}`);
                });

                if (task.error) {
                    writeLine(chalk.red(`\n❌ Hiba: ${task.error}`));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez tasks cancel <id>
     * Cancel a running task
     */
    tasks
        .command('cancel')
        .argument('<id>', 'Task ID')
        .description('Futó feladat megszakítása')
        .action(async (id: string) => {
            const spinner = ora(`Feladat megszakítása: ${id}`).start();

            try {
                const result = await apiFetch<{ success: boolean; cancelled: boolean; message: string }>(
                    `/tasks/${id}`,
                    { method: 'DELETE' }
                );

                if (result.cancelled) {
                    spinner.succeed(chalk.green('Feladat megszakítva!'));
                    writeLine(chalk.cyan(result.message));
                } else {
                    spinner.fail(chalk.red('Megszakítás sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                writeLine(chalk.red(err.message));
                process.exit(1);
            }
        });

    /**
     * brunella robotkez interactive
     * REPL mode for interactive browser automation
     */
    robotkez
        .command('interactive')
        .alias('repl')
        .description('Interaktív REPL mód')
        .action(async () => {
            writeLine(chalk.cyan('\n🤖 RobotkezV2 Interaktív Mód\n'));
            writeLine(chalk.gray('   Írj magyar nyelvű utasításokat a böngésző vezérléséhez.'));
            writeLine(chalk.gray('   Kilépés: exit, quit, vagy Ctrl+C\n'));

            let running = true;

            while (running) {
                try {
                    const { instruction } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'instruction',
                            message: chalk.cyan('robotkez>'),
                            prefix: '',
                        },
                    ]);

                    const trimmed = instruction.trim();
                    if (!trimmed) continue;
                    if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
                        writeLine(chalk.yellow('\n👋 Viszlát!'));
                        running = false;
                        break;
                    }

                    // Special commands
                    if (trimmed === 'status') {
                        const result = await apiFetch<any>('/status');
                        writeLine(chalk.green(`   ✅ Böngésző: ${result.browser.active ? 'Aktív' : 'Leállítva'}`));
                        writeLine(chalk.gray(`   Futó feladatok: ${result.tasks.running}`));
                        continue;
                    }

                    if (trimmed === 'help') {
                        writeLine(chalk.cyan('\n📚 Parancsok:'));
                        writeLine(chalk.gray('   status    - Ügynök státusz'));
                        writeLine(chalk.gray('   help      - Súgó'));
                        writeLine(chalk.gray('   exit/quit - Kilépés'));
                        writeLine(chalk.gray('   <utasítás> - Magyar nyelvű böngésző parancs\n'));
                        continue;
                    }

                    // Execute instruction
                    const spinner = ora('Feldolgozás...').start();

                    try {
                        const result = await apiFetch<{ success: boolean; message: string; data?: any }>(
                            '/chat',
                            {
                                method: 'POST',
                                body: JSON.stringify({ instruction: trimmed }),
                            }
                        );

                        if (result.success) {
                            spinner.succeed(chalk.green('Kész!'));
                            writeLine(chalk.cyan(`   ${result.message}`));

                            if (result.data?.taskId) {
                                writeLine(chalk.yellow(`   🔄 Háttérben fut (ID: ${result.data.taskId})`));
                            }
                        } else {
                            spinner.fail(chalk.red('Hiba'));
                            writeLine(chalk.red(`   ${result.message}`));
                        }
                    } catch (error: unknown) {
                        const err = ensureError(error);
                        spinner.fail(chalk.red('API hiba'));
                        writeLine(chalk.red(`   ${err.message}`));
                    }
                } catch (error: unknown) {
                    const err = ensureError(error);
                    if (err.message?.includes('User force closed')) {
                        writeLine(chalk.yellow('\n👋 Viszlát!'));
                        running = false;
                    } else {
                        writeLine(chalk.red(`Hiba: ${err.message}`));
                    }
                }
            }
        });

    return robotkez;
}
