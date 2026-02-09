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
        .option('--context <mode>', 'Context gathering: auto | none (default: none)')
        .action(async (promptParts: string[], opts: { file?: string; test?: boolean; context?: string }) => {
            const prompt = promptParts.join(' ');
            const spinner = ora(`Generating code...`).start();

            try {
                const context: Record<string, unknown> = {};
                if (opts.file) context.filePath = opts.file;
                if (opts.test === false) context.skipTests = true;
                if (opts.context === 'auto' && opts.file) {
                    spinner.text = 'Gathering context...';
                    try {
                        const ctxResult = await apiFetch<{ context: { files: Array<{ relativePath: string; size: number }> } }>('/context', {
                            method: 'POST',
                            body: JSON.stringify({ filePath: opts.file }),
                        });
                        context.contextFiles = ctxResult.context.files.map(f => f.relativePath);
                        spinner.text = `Context: ${ctxResult.context.files.length} files. Generating code...`;
                    } catch {
                        // Context gathering failed, continue without context
                        spinner.text = 'Generating code (no context)...';
                    }
                }

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
        .description('Review code quality with AI-powered analysis')
        .option('--json', 'Output raw JSON')
        .action(async (file: string, opts: { json?: boolean }) => {
            const spinner = ora(`Reviewing ${chalk.cyan(file)}...`).start();

            try {
                const result = await apiFetch<{
                    review: {
                        filePath: string;
                        fileName: string;
                        language: string;
                        score: number;
                        summary: string;
                        findings: Array<{
                            severity: string;
                            line?: number;
                            message: string;
                            rule?: string;
                            suggestion?: string;
                        }>;
                        stats: { critical: number; warning: number; info: number; suggestion: number; total: number };
                    };
                }>('/review', {
                    method: 'POST',
                    body: JSON.stringify({ filePath: file }),
                });

                const { review } = result;
                spinner.succeed(chalk.green(`Review complete: ${review.fileName}`));

                if (opts.json) {
                    console.log(JSON.stringify(review, null, 2));
                    return;
                }

                // Score badge
                const scoreColor = review.score >= 80 ? chalk.green : review.score >= 60 ? chalk.yellow : chalk.red;
                console.log(`\n${chalk.bold('Score:')} ${scoreColor(`${review.score}/100`)}`);
                console.log(`${chalk.bold('Summary:')} ${review.summary}`);

                // Stats line
                console.log(`\n${chalk.bold('Findings:')} ${review.stats.total} total — ` +
                    `${chalk.red(`${review.stats.critical} critical`)} · ` +
                    `${chalk.yellow(`${review.stats.warning} warnings`)} · ` +
                    `${chalk.blue(`${review.stats.info} info`)} · ` +
                    `${chalk.dim(`${review.stats.suggestion} suggestions`)}`);

                // Individual findings
                if (review.findings.length > 0) {
                    console.log('');
                    for (const f of review.findings) {
                        const icon = f.severity === 'critical' ? chalk.red('✖') :
                            f.severity === 'warning' ? chalk.yellow('⚠') :
                                f.severity === 'info' ? chalk.blue('ℹ') : chalk.dim('💡');
                        const lineRef = f.line ? chalk.dim(`:${f.line}`) : '';
                        const rule = f.rule ? chalk.dim(` [${f.rule}]`) : '';
                        console.log(`  ${icon} ${f.message}${lineRef}${rule}`);
                        if (f.suggestion) {
                            console.log(`    ${chalk.dim('→')} ${chalk.cyan(f.suggestion)}`);
                        }
                    }
                }
                console.log('');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Review failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev refactor <file> <instruction>
    dev
        .command('refactor <file> <instruction...>')
        .description('Refactor a file with a specific instruction')
        .option('--apply', 'Apply refactored code to file')
        .action(async (file: string, instructionParts: string[], opts: { apply?: boolean }) => {
            const instruction = instructionParts.join(' ');
            const spinner = ora(`Refactoring ${chalk.cyan(file)}...`).start();

            try {
                const result = await apiFetch<{
                    refactor: {
                        filePath: string;
                        changes: string[];
                        instruction: string;
                        applied: boolean;
                        refactoredCode?: string;
                    };
                }>('/refactor', {
                    method: 'POST',
                    body: JSON.stringify({ filePath: file, instruction, apply: opts.apply }),
                });

                const { refactor } = result;

                if (refactor.applied) {
                    spinner.succeed(chalk.green(`Refactoring applied to ${file}`));
                } else {
                    spinner.succeed(chalk.green('Refactoring complete (dry run)'));
                }

                console.log(`\n${chalk.bold('Instruction:')} ${refactor.instruction}`);
                console.log(`${chalk.bold('Changes:')}`);
                for (const change of refactor.changes) {
                    console.log(`  • ${change}`);
                }

                if (!refactor.applied && refactor.refactoredCode) {
                    console.log(`\n${chalk.dim('Preview (use --apply to write):')}`);
                    console.log(chalk.dim('─'.repeat(60)));
                    console.log(refactor.refactoredCode.slice(0, 2000));
                    if (refactor.refactoredCode.length > 2000) {
                        console.log(chalk.dim(`\n... (${refactor.refactoredCode.length} chars total)`));
                    }
                }
                console.log('');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Refactor failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev context <file> — P5: Show context files
    dev
        .command('context <file>')
        .description('Show related context files for a target file')
        .option('-n, --max <count>', 'Maximum context files', '10')
        .option('--json', 'Output raw JSON')
        .action(async (file: string, opts: { max: string; json?: boolean }) => {
            const spinner = ora(`Gathering context for ${chalk.cyan(file)}...`).start();

            try {
                const result = await apiFetch<{
                    context: {
                        targetFile: string;
                        totalSize: number;
                        truncated: boolean;
                        files: Array<{ relativePath: string; reason: string; size: number }>;
                    };
                }>('/context', {
                    method: 'POST',
                    body: JSON.stringify({
                        filePath: file,
                        options: { maxFiles: parseInt(opts.max) || 10 },
                    }),
                });

                const { context } = result;
                spinner.succeed(chalk.green(`Found ${context.files.length} context files`));

                if (opts.json) {
                    console.log(JSON.stringify(context, null, 2));
                    return;
                }

                console.log(`\n${chalk.bold('Target:')} ${file}`);
                console.log(`${chalk.bold('Total size:')} ${(context.totalSize / 1024).toFixed(1)} KB`);
                if (context.truncated) {
                    console.log(chalk.yellow('⚠ Context was truncated due to size limits'));
                }

                if (context.files.length > 0) {
                    console.log(`\n${chalk.bold('Context files:')}`);
                    for (const f of context.files) {
                        const sizeStr = chalk.dim(`(${(f.size / 1024).toFixed(1)} KB)`);
                        console.log(`  ${chalk.cyan(f.relativePath)} ${sizeStr}`);
                        console.log(`    ${chalk.dim(f.reason)}`);
                    }
                } else {
                    console.log(chalk.dim('\nNo context files found.'));
                }
                console.log('');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Context gathering failed: ${msg}`));
                process.exit(1);
            }
        });

    // brunella dev coverage — P6: Test coverage analysis
    dev
        .command('coverage')
        .description('Analyze test coverage')
        .option('--run', 'Re-run tests to generate fresh coverage')
        .option('--worst <count>', 'Show N worst-covered files', '10')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { run?: boolean; worst: string; json?: boolean }) => {
            const mode = opts.run ? 'run' : 'parse';
            const spinner = ora(
                mode === 'run'
                    ? 'Running tests with coverage...'
                    : 'Parsing existing coverage data...'
            ).start();

            try {
                const data = await apiFetch<{
                    coverage: {
                        totalFiles: number;
                        filesWithTests: number;
                        filesWithoutTests: number;
                        aggregate: {
                            statements: { pct: number; covered: number; total: number };
                            branches: { pct: number; covered: number; total: number };
                            functions: { pct: number; covered: number; total: number };
                            lines: { pct: number; covered: number; total: number };
                        };
                        worstFiles: Array<{
                            relativePath: string;
                            lines: { pct: number };
                            functions: { pct: number };
                            uncoveredLines: number[];
                        }>;
                        untestedFiles: string[];
                    };
                }>('/coverage', {
                    method: 'POST',
                    body: JSON.stringify({ mode }),
                });

                const { coverage } = data;
                spinner.succeed(chalk.green('Coverage analysis complete'));

                if (opts.json) {
                    console.log(JSON.stringify(coverage, null, 2));
                    return;
                }

                // Aggregate metrics
                const agg = coverage.aggregate;
                const colorize = (pct: number) =>
                    pct >= 80 ? chalk.green(`${pct}%`) :
                    pct >= 60 ? chalk.yellow(`${pct}%`) :
                    chalk.red(`${pct}%`);

                console.log(`\n${chalk.bold('📊 Coverage Summary')}`);
                console.log(`  Statements: ${colorize(agg.statements.pct)}  (${agg.statements.covered}/${agg.statements.total})`);
                console.log(`  Branches:   ${colorize(agg.branches.pct)}  (${agg.branches.covered}/${agg.branches.total})`);
                console.log(`  Functions:  ${colorize(agg.functions.pct)}  (${agg.functions.covered}/${agg.functions.total})`);
                console.log(`  Lines:      ${colorize(agg.lines.pct)}  (${agg.lines.covered}/${agg.lines.total})`);
                console.log(`\n  Files: ${coverage.filesWithTests} tested / ${coverage.filesWithoutTests} untested / ${coverage.totalFiles} total`);

                // Worst files
                const worstLimit = parseInt(opts.worst) || 10;
                const worst = coverage.worstFiles.slice(0, worstLimit);
                if (worst.length > 0) {
                    console.log(`\n${chalk.bold('⚠ Lowest Coverage Files:')}`);
                    for (const f of worst) {
                        const linePct = colorize(f.lines.pct);
                        const fnPct = colorize(f.functions.pct);
                        console.log(`  ${chalk.cyan(f.relativePath)}  lines: ${linePct}  fn: ${fnPct}`);
                        if (f.uncoveredLines.length > 0 && f.uncoveredLines.length <= 20) {
                            console.log(`    ${chalk.dim(`uncovered: L${f.uncoveredLines.join(', L')}`)}`);
                        }
                    }
                }

                // Untested files
                if (coverage.untestedFiles.length > 0) {
                    console.log(`\n${chalk.bold('❌ Files Without Tests:')}`);
                    for (const f of coverage.untestedFiles.slice(0, 15)) {
                        console.log(`  ${chalk.red(f)}`);
                    }
                    if (coverage.untestedFiles.length > 15) {
                        console.log(chalk.dim(`  ... and ${coverage.untestedFiles.length - 15} more`));
                    }
                }

                console.log('');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Coverage analysis failed: ${msg}`));
                process.exit(1);
            }
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

    // brunella dev queue — P7: Task Queue Management
    const queue = dev.command('queue').description('Manage developer task queue');

    queue
        .command('list')
        .description('List all queued tasks')
        .option('--status <status>', 'Filter by status (queued/running/completed/failed/cancelled)')
        .option('--type <type>', 'Filter by task type')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { status?: string; type?: string; json?: boolean }) => {
            const spinner = ora('Fetching task queue...').start();

            try {
                const params = new URLSearchParams();
                if (opts.status) params.set('status', opts.status);
                if (opts.type) params.set('type', opts.type);

                const result = await apiFetch<{
                    tasks: Array<{
                        id: string;
                        type: string;
                        description: string;
                        priority: string;
                        status: string;
                        createdAt: number;
                        startedAt?: number;
                        completedAt?: number;
                        error?: string;
                    }>;
                    stats: {
                        total: number;
                        queued: number;
                        running: number;
                        completed: number;
                        failed: number;
                        cancelled: number;
                    };
                }>(`/queue?${params}`);

                const { tasks, stats } = result;
                spinner.succeed(chalk.green(`Found ${tasks.length} tasks`));

                if (opts.json) {
                    console.log(JSON.stringify({ tasks, stats }, null, 2));
                    return;
                }

                console.log(`\n${chalk.bold('📊 Queue Stats:')}`);
                console.log(`  Total: ${stats.total} | Queued: ${stats.queued} | Running: ${chalk.yellow(stats.running)} | ✅ ${stats.completed} | ❌ ${stats.failed}`);

                if (tasks.length === 0) {
                    console.log(chalk.dim('\nNo tasks in queue.'));
                    return;
                }

                console.log(`\n${chalk.bold('📋 Tasks:')}\n`);
                for (const task of tasks) {
                    const statusColor = task.status === 'completed' ? chalk.green :
                        task.status === 'failed' ? chalk.red :
                        task.status === 'running' ? chalk.yellow :
                        task.status === 'cancelled' ? chalk.gray : chalk.blue;

                    const priority = task.priority === 'high' ? chalk.red('HIGH') :
                        task.priority === 'medium' ? chalk.yellow('MED') : chalk.gray('LOW');

                    console.log(`  ${chalk.cyan(task.id)} ${priority} [${statusColor(task.status)}]`);
                    console.log(`    ${chalk.dim(task.type)}: ${task.description.slice(0, 60)}`);
                    if (task.error) {
                        console.log(`    ${chalk.red('Error:')} ${task.error.slice(0, 80)}`);
                    }
                    console.log('');
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to list queue: ${msg}`));
                process.exit(1);
            }
        });

    queue
        .command('add <type> <description>')
        .description('Add a task to the queue')
        .option('-p, --priority <priority>', 'Priority: high/medium/low', 'medium')
        .option('--json', 'Output raw JSON')
        .action(async (type: string, description: string, opts: { priority: string; json?: boolean }) => {
            const spinner = ora(`Adding ${type} task to queue...`).start();

            try {
                const result = await apiFetch<{
                    task: {
                        id: string;
                        type: string;
                        description: string;
                        priority: string;
                        status: string;
                    };
                }>('/queue', {
                    method: 'POST',
                    body: JSON.stringify({ type, description, priority: opts.priority, params: {} }),
                });

                const { task } = result;
                spinner.succeed(chalk.green(`Task added: ${task.id}`));

                if (opts.json) {
                    console.log(JSON.stringify(task, null, 2));
                    return;
                }

                console.log(`\n  ID: ${chalk.cyan(task.id)}`);
                console.log(`  Type: ${task.type}`);
                console.log(`  Priority: ${task.priority}`);
                console.log(`  Status: ${task.status}\n`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to add task: ${msg}`));
                process.exit(1);
            }
        });

    queue
        .command('cancel <taskId>')
        .description('Cancel a queued or running task')
        .action(async (taskId: string) => {
            const spinner = ora(`Cancelling task ${taskId}...`).start();

            try {
                const result = await apiFetch<{
                    task: { id: string; status: string };
                    message: string;
                }>(`/queue/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ action: 'cancel' }),
                });

                spinner.succeed(chalk.green(result.message));
                console.log(`  Status: ${result.task.status}`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to cancel task: ${msg}`));
                process.exit(1);
            }
        });

    queue
        .command('retry <taskId>')
        .description('Retry a failed task')
        .action(async (taskId: string) => {
            const spinner = ora(`Retrying task ${taskId}...`).start();

            try {
                const result = await apiFetch<{
                    task: { id: string };
                    message: string;
                }>(`/queue/${taskId}/retry`, {
                    method: 'POST',
                });

                spinner.succeed(chalk.green(result.message));
                console.log(`  New Task ID: ${chalk.cyan(result.task.id)}`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to retry task: ${msg}`));
                process.exit(1);
            }
        });
}
