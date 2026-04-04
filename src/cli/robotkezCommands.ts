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
                    console.log(chalk.cyan('\n📝 Result:'));
                    const data = result.data as any;
                    if (data?.mode) console.log(chalk.gray(`   Mode: ${data.mode}`));
                    if (data?.duration_ms) console.log(chalk.gray(`   Duration: ${data.duration_ms}ms`));
                    if (data?.screenshot_path) {
                        console.log(chalk.green(`   Screenshot: ${data.screenshot_path}`));
                    }
                    if (result.message) {
                        console.log(chalk.gray(`   ${result.message}`));
                    }
                } else {
                    spinner.fail(chalk.red('Failed'));
                    console.log(chalk.red(`Error: ${result.error}`));
                    process.exit(1);
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('Execution error'));
                console.log(chalk.red(err.message));
                if (err.stack) {
                    console.log(chalk.gray(err.stack));
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
                    console.log(chalk.cyan('\n📝 Eredmény:'), result.message);

                    if (result.data?.taskId) {
                        console.log(chalk.yellow('\n🔄 Háttérben fut...'));
                        console.log(chalk.gray(`   Task ID: ${result.data.taskId}`));
                        console.log(chalk.gray(`   Becsült idő: ${formatDuration(result.data.estimatedDuration || 0)}`));
                    }
                } else {
                    spinner.fail(chalk.red('Hiba történt'));
                    console.log(chalk.red(result.message));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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
                    console.log(chalk.cyan(`\n📋 Lépések (${result.plan.plan.length}):
`));

                    result.plan.plan.forEach((step: any, i: number) => {
                        console.log(chalk.gray(`   ${i + 1}. ${step.action}: ${step.description}`));
                    });

                    console.log(chalk.yellow(`\n⏱️  Becsült idő: ${formatDuration(result.plan.estimatedDuration)}`));
                    console.log(chalk.gray(`   Háttér jogosult: ${result.plan.backgroundEligible ? 'Igen' : 'Nem'}`));
                } else {
                    spinner.fail(chalk.red('Terv generálás sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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
                    console.log(chalk.cyan(result.message));
                } else {
                    spinner.fail(chalk.red('Művelet sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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

                console.log(chalk.cyan('\n🤖 Ügynök:'));
                console.log(chalk.gray(`   Név: ${result.agent.name}`));
                console.log(chalk.gray(`   Szerepkör: ${result.agent.role}`));
                console.log(chalk.gray(`   Képességek: ${result.agent.capabilities.join(', ')}`));

                console.log(chalk.cyan('\n🌐 Böngésző:'));
                console.log(chalk.gray(`   Aktív: ${result.browser.active ? chalk.green('✅ Igen') : chalk.red('❌ Nem')}`));
                console.log(chalk.gray(`   Motor: ${result.browser.engine}`));

                console.log(chalk.cyan('\n📋 Feladatok:'));
                console.log(chalk.gray(`   Összes: ${result.tasks.total}`));
                console.log(chalk.gray(`   Futó: ${chalk.blue(result.tasks.running)}`));
                console.log(chalk.gray(`   Befejezett: ${chalk.green(result.tasks.completed)}`));
                console.log(chalk.gray(`   Hibák: ${chalk.red(result.tasks.error)}`));
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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
                console.log(chalk.cyan(`   📸 Fájl: ${outputPath}`));
                console.log(chalk.gray(`   Méret: ${(buffer.byteLength / 1024).toFixed(1)} KB`));
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('Screenshot hiba'));
                console.log(chalk.red(err.message));
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
                    console.log(chalk.yellow('\n📋 Nincsenek feladatok'));
                    return;
                }

                console.log(chalk.cyan(`\n📋 Feladatok (${result.count}):\n`));

                result.tasks.forEach((task: any) => {
                    const icon = getStatusIcon(task.status);
                    console.log(`${icon} ${chalk.bold(task.instruction.slice(0, 60))}${task.instruction.length > 60 ? '...' : ''}`);
                    console.log(chalk.gray(`   ID: ${task.id}`));
                    console.log(chalk.gray(`   Státusz: ${task.status} (${task.progress}%)`));
                    console.log(chalk.gray(`   Indítva: ${formatTime(task.startedAt)}`));
                    if (task.error) {
                        console.log(chalk.red(`   Hiba: ${task.error}`));
                    }
                    console.log();
                });
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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

                console.log(chalk.cyan(`\n${icon} Feladat Részletek:\n`));
                console.log(chalk.gray(`   ID: ${task.id}`));
                console.log(chalk.gray(`   Utasítás: ${task.instruction}`));
                console.log(chalk.gray(`   Státusz: ${task.status}`));
                console.log(chalk.gray(`   Progress: ${task.progress}%`));
                console.log(chalk.gray(`   Indítva: ${formatTime(task.startedAt)}`));
                if (task.completedAt) {
                    console.log(chalk.gray(`   Befejezve: ${formatTime(task.completedAt)}`));
                    console.log(chalk.gray(`   Időtartam: ${formatDuration(task.completedAt - task.startedAt)}`));
                }

                console.log(chalk.cyan(`\n📝 Lépések (${task.steps.length}):\n`));
                task.steps.forEach((step: any, i: number) => {
                    const stepIcon = getStatusIcon(step.status);
                    console.log(`   ${stepIcon} ${step.description}`);
                });

                if (task.error) {
                    console.log(chalk.red(`\n❌ Hiba: ${task.error}`));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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
                    console.log(chalk.cyan(result.message));
                } else {
                    spinner.fail(chalk.red('Megszakítás sikertelen'));
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                spinner.fail(chalk.red('API hiba'));
                console.log(chalk.red(err.message));
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
            console.log(chalk.cyan('\n🤖 RobotkezV2 Interaktív Mód\n'));
            console.log(chalk.gray('   Írj magyar nyelvű utasításokat a böngésző vezérléséhez.'));
            console.log(chalk.gray('   Kilépés: exit, quit, vagy Ctrl+C\n'));

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
                        console.log(chalk.yellow('\n👋 Viszlát!'));
                        running = false;
                        break;
                    }

                    // Special commands
                    if (trimmed === 'status') {
                        const result = await apiFetch<any>('/status');
                        console.log(chalk.green(`   ✅ Böngésző: ${result.browser.active ? 'Aktív' : 'Leállítva'}`));
                        console.log(chalk.gray(`   Futó feladatok: ${result.tasks.running}`));
                        continue;
                    }

                    if (trimmed === 'help') {
                        console.log(chalk.cyan('\n📚 Parancsok:'));
                        console.log(chalk.gray('   status    - Ügynök státusz'));
                        console.log(chalk.gray('   help      - Súgó'));
                        console.log(chalk.gray('   exit/quit - Kilépés'));
                        console.log(chalk.gray('   <utasítás> - Magyar nyelvű böngésző parancs\n'));
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
                            console.log(chalk.cyan(`   ${result.message}`));

                            if (result.data?.taskId) {
                                console.log(chalk.yellow(`   🔄 Háttérben fut (ID: ${result.data.taskId})`));
                            }
                        } else {
                            spinner.fail(chalk.red('Hiba'));
                            console.log(chalk.red(`   ${result.message}`));
                        }
                    } catch (error: unknown) {
                        const err = ensureError(error);
                        spinner.fail(chalk.red('API hiba'));
                        console.log(chalk.red(`   ${err.message}`));
                    }
                } catch (error: unknown) {
                    const err = ensureError(error);
                    if (err.message?.includes('User force closed')) {
                        console.log(chalk.yellow('\n👋 Viszlát!'));
                        running = false;
                    } else {
                        console.log(chalk.red(`Hiba: ${err.message}`));
                    }
                }
            }
        });

    return robotkez;
}
