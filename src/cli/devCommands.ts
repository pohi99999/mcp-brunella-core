/**
 * Developer CLI Commands (P2)
 *
 * `brunella dev` alparancs-csoport a Developer Agent 3.0-hoz
 *
 * Parancsok:
 *  - brunella dev generate <prompt>    # Kód generálás
 *  - brunella dev test <file>          # Teszt generálás
 *  - brunella dev fix [--auto]         # Hiba javítás
 *  - brunella dev heal                 # Self-heal futtatás
 *  - brunella dev review <file>        # Kód review (Fázis 2)
 *  - brunella dev status               # Pipeline állapot
 *  - brunella dev history              # Feladat történet
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { BrunellaClient } from '../utils/mcpClient.js';
import { logInfo, logError } from '../utils/logger.js';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

/**
 * Simple fetch helper for CLI → REST API calls
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}/api/v1/developer${path}`;
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
 * Execute a developer task via the REST API
 */
async function executeDevTask(task: string, context?: Record<string, unknown>): Promise<{ taskId: string; status: string }> {
    return apiFetch('/execute', {
        method: 'POST',
        body: JSON.stringify({ task, context }),
    });
}

/**
 * Poll pipeline status until done or error
 */
async function pollPipeline(taskId: string, spinner: ReturnType<typeof ora>): Promise<void> {
    const maxAttempts = 120; // 2 minute timeout at 1s intervals
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const result = await apiFetch<{ pipeline: { status: string; phases: Array<{ id: string; label: string; status: string }> } }>(`/pipeline/${taskId}`);
            const { pipeline } = result;

            // Update spinner with current phase
            const activePhase = pipeline.phases.find((p: { status: string }) => p.status === 'running');
            if (activePhase) {
                spinner.text = `${chalk.cyan(activePhase.label)}...`;
            }

            if (pipeline.status === 'done') {
                spinner.succeed(chalk.green('Task completed successfully'));
                // Show phase summary
                for (const phase of pipeline.phases) {
                    const icon = phase.status === 'done' ? '✅' :
                        phase.status === 'skipped' ? '⏭️' :
                            phase.status === 'error' ? '❌' : '⏳';
                    console.log(`  ${icon} ${phase.label}: ${phase.status}`);
                }
                return;
            }

            if (pipeline.status === 'error') {
                spinner.fail(chalk.red('Task failed'));
                for (const phase of pipeline.phases) {
                    const icon = phase.status === 'done' ? '✅' :
                        phase.status === 'error' ? '❌' : '⏳';
                    console.log(`  ${icon} ${phase.label}: ${phase.status}`);
                }
                return;
            }
        } catch {
            // Ignore polling errors, keep trying
        }
    }

    spinner.warn(chalk.yellow('Polling timeout — check status manually'));
}

/**
 * Register `brunella dev` subcommands
 */
export function registerDevCommands(program: Command): void {
    const dev = program.command('dev').description('Developer Agent commands (code gen, test, fix, heal)');

    // brunella dev generate <prompt>
    dev
        .command('generate <prompt...>')
        .description('Generate code from a natural language prompt')
        .option('-f, --file <path>', 'Save generated code to file')
        .option('--no-test', 'Skip test phase')
        .action(async (promptParts: string[], opts: { file?: string; test?: boolean }) => {
            const prompt = promptParts.join(' ');
            const spinner = ora(`Generating code...`).start();

            try {
                const context: Record<string, unknown> = {};
                if (opts.file) context.filePath = opts.file;
                if (opts.test === false) context.skipTests = true;

                const { taskId } = await executeDevTask(
                    `generate code: ${prompt}`,
                    context
                );

                spinner.text = `Pipeline started: ${chalk.dim(taskId)}`;
                await pollPipeline(taskId, spinner);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Generation failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev test <file>
    dev
        .command('test <file>')
        .description('Generate tests for a source file')
        .option('-o, --output <path>', 'Output test file path')
        .action(async (file: string, opts: { output?: string }) => {
            const spinner = ora(`Generating tests for ${chalk.cyan(file)}...`).start();

            try {
                const context: Record<string, unknown> = {
                    filePath: file,
                };
                if (opts.output) context.testFilePath = opts.output;

                const { taskId } = await executeDevTask(
                    `generate vitest tests for ${file}`,
                    context
                );

                spinner.text = `Pipeline started: ${chalk.dim(taskId)}`;
                await pollPipeline(taskId, spinner);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Test generation failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev fix [--auto]
    dev
        .command('fix')
        .description('Fix build or test errors')
        .option('--auto', 'Auto-detect and fix all errors')
        .option('-f, --file <path>', 'File to fix')
        .option('-e, --error <message>', 'Error message to fix')
        .action(async (opts: { auto?: boolean; file?: string; error?: string }) => {
            const spinner = ora('Fixing errors...').start();

            try {
                const context: Record<string, unknown> = {};
                if (opts.file) context.filePath = opts.file;
                if (opts.error) context.error = opts.error;
                if (opts.auto) context.autoFix = true;

                const task = opts.auto
                    ? 'fix all build errors automatically'
                    : `fix error${opts.file ? ` in ${opts.file}` : ''}${opts.error ? `: ${opts.error}` : ''}`;

                const { taskId } = await executeDevTask(task, context);

                spinner.text = `Pipeline started: ${chalk.dim(taskId)}`;
                await pollPipeline(taskId, spinner);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Fix failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev heal
    dev
        .command('heal')
        .description('Run self-healing build cycle')
        .action(async () => {
            const spinner = ora('Running self-heal...').start();

            try {
                const { taskId } = await executeDevTask(
                    'self-heal: fix all build errors and ensure npm run build succeeds'
                );

                spinner.text = `Pipeline started: ${chalk.dim(taskId)}`;
                await pollPipeline(taskId, spinner);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Self-heal failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev review <file>
    dev
        .command('review <file>')
        .description('Review code quality (Fázis 2 — coming soon)')
        .action(async (file: string) => {
            console.log(chalk.yellow(`⚠️  Code review for ${chalk.cyan(file)} — coming in Fázis 2 (P4)`));
            console.log(chalk.dim('Use: brunella agent Developer "review code in ' + file + '"'));
        });

    // brunella dev status
    dev
        .command('status')
        .description('Show active developer pipelines')
        .action(async () => {
            try {
                const result = await apiFetch<{
                    activeTasks: number;
                    completedTasks: number;
                    failedTasks: number;
                    totalTasks: number;
                    activePipelines: Array<{ taskId: string; task: string; status: string; createdAt: number }>;
                }>('/status');

                console.log(chalk.bold('\n📊 Developer Agent Status'));
                console.log(`  Active:    ${chalk.cyan(String(result.activeTasks))}`);
                console.log(`  Completed: ${chalk.green(String(result.completedTasks))}`);
                console.log(`  Failed:    ${chalk.red(String(result.failedTasks))}`);
                console.log(`  Total:     ${result.totalTasks}\n`);

                if (result.activePipelines.length > 0) {
                    console.log(chalk.bold('Active Pipelines:'));
                    console.table(result.activePipelines.map(p => ({
                        TaskId: p.taskId.slice(0, 20),
                        Task: p.task.slice(0, 40),
                        Status: p.status,
                        Started: new Date(p.createdAt).toLocaleTimeString(),
                    })));
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(chalk.red(`Failed to get status: ${msg}`));
                console.log(chalk.dim('Is the server running? Try: npm run dev'));
                process.exit(1);
            }
        });

    // brunella dev history
    dev
        .command('history')
        .description('Show recent developer task history')
        .option('-n, --limit <count>', 'Number of entries', '10')
        .action(async (opts: { limit: string }) => {
            try {
                const limit = parseInt(opts.limit) || 10;
                const result = await apiFetch<{
                    history: Array<{
                        taskId: string;
                        task: string;
                        status: string;
                        createdAt: number;
                        completedAt?: number;
                    }>;
                }>(`/history?limit=${limit}`);

                if (result.history.length === 0) {
                    console.log(chalk.dim('No developer tasks yet.'));
                    return;
                }

                console.log(chalk.bold(`\n📜 Developer Task History (last ${limit}):\n`));
                console.table(result.history.map(p => ({
                    TaskId: p.taskId.slice(0, 20),
                    Task: p.task.slice(0, 40),
                    Status: p.status === 'done' ? chalk.green(p.status) :
                        p.status === 'error' ? chalk.red(p.status) :
                            chalk.yellow(p.status),
                    Duration: p.completedAt
                        ? `${((p.completedAt - p.createdAt) / 1000).toFixed(1)}s`
                        : '-',
                    Time: new Date(p.createdAt).toLocaleTimeString(),
                })));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(chalk.red(`Failed to get history: ${msg}`));
                process.exit(1);
            }
        });
}
