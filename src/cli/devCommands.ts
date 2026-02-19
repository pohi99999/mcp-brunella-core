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
import inquirer from 'inquirer';
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

    // brunella dev ai-interpreter
    dev
        .command('ai-interpreter')
        .alias('ai')
        .description('AI-powered persistent Python interpreter (Comet-style)')
        .option('-m, --model <name>', 'Preferred model (gpt-4o, qwen2.5-coder)')
        .action(async (opts: { model?: string }) => {
            console.log(chalk.cyan.bold('\n🧠 Brunella AI-Interpreter (Comet Mode)'));
            console.log(chalk.dim('Utasításaidat Python kódra fordítom és azonnal futtatom.'));
            console.log(chalk.dim('Kilépés: "exit" vagy "quit"\n'));

            const client = new BrunellaClient();
            try {
                await client.connect();
                
                // Conversational context (RULE-OB2: History tracking)
                const history: Array<{ role: 'user' | 'assistant', content: string }> = [];

                while (true) {
                    const { instruction } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'instruction',
                            message: chalk.green('AI ❯'),
                        }
                    ]);

                    if (['exit', 'quit'].includes(instruction.toLowerCase().trim())) break;
                    if (!instruction.trim()) continue;

                    const spinner = ora('Gondolkozom...').start();

                    try {
                        // Special mode for the developer agent: interpreter
                        const { taskId } = await executeDevTask(instruction, {
                            mode: 'interpreter',
                            model: opts.model,
                            persist: true,
                            history: history.slice(-10) // Keep last 10 messages for context
                        });

                        spinner.text = 'Kód futtatása...';
                        
                        // We poll the pipeline, but we want the ACTUAL output once done
                        await pollPipeline(taskId, spinner);
                        
                        // After polling, fetch the pipeline result
                        const { pipeline } = await apiFetch<{ pipeline: { result?: any, error?: string } }>(`/pipeline/${taskId}`);
                        
                        if (pipeline.result && pipeline.result.status === 'success') {
                            const output = pipeline.result.data.output;
                            const generatedCode = pipeline.result.data.code;

                            console.log(chalk.white('\n--- Kimenet ---'));
                            console.log(output || chalk.dim('(nincs szöveges kimenet)'));
                            console.log(chalk.white('---------------\n'));

                            // Add to history
                            history.push({ role: 'user', content: instruction });
                            history.push({ role: 'assistant', content: `Kód futtatva. Kimenet: ${output}` });

                        } else if (pipeline.error) {
                            console.log(chalk.red(`\n❌ Hiba: ${pipeline.error}\n`));
                        }

                    } catch (e: any) {
                        spinner.fail(chalk.red('Hiba történt.'));
                        console.error(chalk.red(e.message));
                    }
                }
            } catch (e: any) {
                console.error(chalk.red(`Kapcsolati hiba: ${e.message}`));
            } finally {
                await client.close();
                process.exit(0);
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

    // brunella dev metrics — P10: Metrics & Analytics
    dev
        .command('metrics')
        .description('Show developer agent metrics and analytics')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { json?: boolean }) => {
            try {
                const result = await apiFetch<{
                    metrics: {
                        builds: { total: number; success: number; fail: number; lastStatus: string; lastDurationMs: number };
                        tests: { totalRuns: number; lastPassRate: number; lastDurationMs: number };
                        tasks: { total: number; success: number; error: number; avgDurationMs: number };
                        history: Array<any>;
                    };
                }>('/metrics');

                const { metrics } = result;

                if (opts.json) {
                    console.log(JSON.stringify(metrics, null, 2));
                    return;
                }

                console.log(chalk.bold('\n📊 Developer Agent Metrics & Analytics\n'));

                // Tasks
                console.log(chalk.cyan.bold('  TASKS'));
                console.log(`    Total:      ${metrics.tasks.total}`);
                console.log(`    Success:    ${chalk.green(String(metrics.tasks.success))}`);
                console.log(`    Error:      ${chalk.red(String(metrics.tasks.error))}`);
                console.log(`    Avg Duration: ${chalk.yellow(`${(metrics.tasks.avgDurationMs / 1000).toFixed(1)}s`)}`);

                // Builds
                console.log(chalk.cyan.bold('\n  BUILDS'));
                console.log(`    Total:      ${metrics.builds.total}`);
                console.log(`    Success:    ${chalk.green(String(metrics.builds.success))}`);
                console.log(`    Fail:       ${chalk.red(String(metrics.builds.fail))}`);
                const statusColor = metrics.builds.lastStatus === 'success' ? chalk.green : chalk.red;
                console.log(`    Last Status: ${statusColor(metrics.builds.lastStatus)} (${(metrics.builds.lastDurationMs / 1000).toFixed(1)}s)`);

                // Tests
                console.log(chalk.cyan.bold('\n  TESTS'));
                console.log(`    Total Runs: ${metrics.tests.totalRuns}`);
                const rateColor = metrics.tests.lastPassRate === 100 ? chalk.green : chalk.yellow;
                console.log(`    Last Pass Rate: ${rateColor(`${metrics.tests.lastPassRate}%`)} (${(metrics.tests.lastDurationMs / 1000).toFixed(1)}s)`);

                // History
                if (metrics.history.length > 0) {
                    console.log(chalk.cyan.bold('\n  RECENT ACTIVITY (last 5)'));
                    for (const item of metrics.history.slice(0, 5)) {
                        const type = item.type.toUpperCase().padEnd(6);
                        const status = item.status === 'success' ? chalk.green('OK ') : chalk.red('ERR');
                        const time = new Date(item.timestamp).toLocaleTimeString();
                        console.log(`    ${chalk.dim(time)} ${type} ${status} ${item.details}`);
                    }
                }

                console.log('');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(chalk.red(`Failed to get metrics: ${msg}`));
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

    // brunella dev git — P8: Git Workflow Automatizáció
    const git = dev.command('git').description('Git workflow operations');

    git
        .command('status')
        .description('Show git status')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { json?: boolean }) => {
            const spinner = ora('Getting git status...').start();

            try {
                const result = await apiFetch<{
                    status: {
                        branch: string;
                        remote?: string;
                        ahead: number;
                        behind: number;
                        files: Array<{ path: string; status: string; staged: boolean }>;
                        staged: Array<{ path: string; status: string; staged: boolean }>;
                        unstaged: Array<{ path: string; status: string; staged: boolean }>;
                        untracked: string[];
                        hasChanges: boolean;
                    };
                }>('/git/status');

                const { status } = result;
                spinner.succeed(chalk.green(`Branch: ${status.branch}`));

                if (opts.json) {
                    console.log(JSON.stringify({ status }, null, 2));
                    return;
                }

                // Display branch info
                console.log(`\n${chalk.bold('🌿 Branch:')} ${chalk.cyan(status.branch)}`);
                if (status.remote) {
                    console.log(`  Tracking: ${status.remote}`);
                }
                if (status.ahead > 0) {
                    console.log(`  ${chalk.green(`↑ ${status.ahead} ahead`)}`);
                }
                if (status.behind > 0) {
                    console.log(`  ${chalk.yellow(`↓ ${status.behind} behind`)}`);
                }

                // Display staged files
                if (status.staged.length > 0) {
                    console.log(`\n${chalk.bold('📦 Staged files:')}`);
                    for (const file of status.staged) {
                        console.log(`  ${chalk.green(`+ ${file.path}`)} (${file.status})`);
                    }
                }

                // Display unstaged files
                if (status.unstaged.length > 0) {
                    console.log(`\n${chalk.bold('📝 Unstaged changes:')}`);
                    for (const file of status.unstaged) {
                        console.log(`  ${chalk.yellow(`M ${file.path}`)} (${file.status})`);
                    }
                }

                // Display untracked files
                if (status.untracked.length > 0) {
                    console.log(`\n${chalk.bold('❓ Untracked files:')}`);
                    for (const file of status.untracked) {
                        console.log(`  ${chalk.dim(`? ${file}`)}`);
                    }
                }

                if (!status.hasChanges) {
                    console.log(chalk.dim('\n✨ Working directory clean'));
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to get status: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('diff [file]')
        .description('Show diff for file or all changes')
        .option('--staged', 'Show staged changes only')
        .action(async (file: string | undefined, opts: { staged?: boolean }) => {
            const spinner = ora('Getting diff...').start();

            try {
                const params = new URLSearchParams();
                if (file) params.set('file', file);
                if (opts.staged) params.set('staged', 'true');

                const result = await apiFetch<{
                    diffs: Array<{
                        file: string;
                        diff: string;
                        additions: number;
                        deletions: number;
                    }>;
                }>(`/git/diff?${params}`);

                const { diffs } = result;
                spinner.succeed(chalk.green(`Found ${diffs.length} file(s) with changes`));

                if (diffs.length === 0) {
                    console.log(chalk.dim('No changes'));
                    return;
                }

                for (const diff of diffs) {
                    console.log(`\n${chalk.bold(diff.file)}`);
                    console.log(chalk.green(`+${diff.additions}`) + ' ' + chalk.red(`-${diff.deletions}`));
                    console.log(chalk.dim('─'.repeat(60)));
                    console.log(diff.diff);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to get diff: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('commit <message>')
        .description('Commit staged changes')
        .action(async (message: string) => {
            const spinner = ora('Committing changes...').start();

            try {
                const result = await apiFetch<{
                    commit: {
                        hash: string;
                        message: string;
                        filesChanged: number;
                        insertions: number;
                        deletions: number;
                    };
                }>('/git/commit', {
                    method: 'POST',
                    body: JSON.stringify({ message }),
                });

                const { commit } = result;
                spinner.succeed(chalk.green(`Commit created: ${commit.hash}`));

                console.log(`\n${chalk.bold('📝 Commit Details:')}`);
                console.log(`  Hash:    ${chalk.cyan(commit.hash)}`);
                console.log(`  Message: ${commit.message.substring(0, 60)}...`);
                console.log(`  Files:   ${commit.filesChanged} changed`);
                console.log(`  Lines:   ${chalk.green(`+${commit.insertions}`)} ${chalk.red(`-${commit.deletions}`)}`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to commit: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('push')
        .description('Push to remote')
        .option('--remote <remote>', 'Remote name', 'origin')
        .option('--branch <branch>', 'Branch name (defaults to current)')
        .action(async (opts: { remote?: string; branch?: string }) => {
            const spinner = ora('Pushing to remote...').start();

            try {
                const result = await apiFetch<{
                    push: {
                        success: boolean;
                        branch: string;
                        remote: string;
                        message: string;
                    };
                }>('/git/push', {
                    method: 'POST',
                    body: JSON.stringify({
                        remote: opts.remote || 'origin',
                        branch: opts.branch,
                    }),
                });

                const { push } = result;

                if (push.success) {
                    spinner.succeed(chalk.green(`Pushed ${push.branch} to ${push.remote}`));
                } else {
                    spinner.fail(chalk.red(`Push failed: ${push.message}`));
                    process.exit(1);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to push: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('branches')
        .description('List branches')
        .option('--remote', 'Include remote branches')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { remote?: boolean; json?: boolean }) => {
            const spinner = ora('Listing branches...').start();

            try {
                const params = new URLSearchParams();
                if (opts.remote) params.set('remote', 'true');

                const result = await apiFetch<{
                    branches: Array<{
                        name: string;
                        current: boolean;
                        remote?: string;
                        lastCommit?: string;
                    }>;
                }>(`/git/branches?${params}`);

                const { branches } = result;
                spinner.succeed(chalk.green(`Found ${branches.length} branches`));

                if (opts.json) {
                    console.log(JSON.stringify({ branches }, null, 2));
                    return;
                }

                console.log(`\n${chalk.bold('🌿 Branches:')}\n`);
                for (const branch of branches) {
                    const prefix = branch.current ? chalk.green('* ') : '  ';
                    const name = branch.current ? chalk.green(branch.name) : branch.name;
                    const remote = branch.remote ? chalk.dim(` [${branch.remote}]`) : '';
                    const commit = branch.lastCommit ? chalk.dim(` ${branch.lastCommit}`) : '';
                    console.log(`${prefix}${name}${remote}${commit}`);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to list branches: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('checkout <branch>')
        .description('Checkout a branch')
        .action(async (branch: string) => {
            const spinner = ora(`Checking out ${branch}...`).start();

            try {
                await apiFetch<{ success: boolean; message: string }>(`/git/branch/${branch}`, {
                    method: 'PUT',
                    body: JSON.stringify({ action: 'checkout' }),
                });

                spinner.succeed(chalk.green(`Checked out: ${branch}`));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to checkout: ${msg}`));
                process.exit(1);
            }
        });

    git
        .command('log')
        .description('Show recent commits')
        .option('--limit <limit>', 'Number of commits', '10')
        .option('--json', 'Output raw JSON')
        .action(async (opts: { limit?: string; json?: boolean }) => {
            const spinner = ora('Getting commit log...').start();

            try {
                const params = new URLSearchParams();
                if (opts.limit) params.set('limit', opts.limit);

                const result = await apiFetch<{
                    log: Array<{
                        hash: string;
                        author: string;
                        date: string;
                        message: string;
                    }>;
                }>(`/git/log?${params}`);

                const { log } = result;
                spinner.succeed(chalk.green(`Found ${log.length} commits`));

                if (opts.json) {
                    console.log(JSON.stringify({ log }, null, 2));
                    return;
                }

                console.log(`\n${chalk.bold('📜 Recent Commits:')}\n`);
                for (const commit of log) {
                    console.log(`${chalk.cyan(commit.hash)} ${chalk.dim(commit.date)} ${chalk.yellow(commit.author)}`);
                    console.log(`  ${commit.message}`);
                    console.log('');
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to get log: ${msg}`));
                process.exit(1);
            }
        });

    // ==================== P9: Code Scaffolding Commands ====================

    const scaffoldCmd = dev
        .command('scaffold')
        .description('Code scaffolding operations');

    scaffoldCmd
        .command('list')
        .description('List available code templates')
        .option('--json', 'Output as JSON')
        .action(async (options: { json?: boolean }) => {
            const spinner = ora('Fetching templates...').start();
            try {
                const result = await apiFetch<{ templates: any[] }>('/scaffold/templates');
                const templates = result.templates;
                
                spinner.stop();

                if (options.json) {
                    console.log(JSON.stringify(templates, null, 2));
                    return;
                }

                console.log(chalk.bold('📋 Available Templates:\n'));
                
                // Group by category
                const groups: Record<string, any[]> = {};
                for (const t of templates) {
                    const cat = t.category || 'other';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(t);
                }

                for (const [category, items] of Object.entries(groups)) {
                    console.log(chalk.cyan.bold(`  ${category.toUpperCase()}`));
                    for (const t of items) {
                        console.log(`    ${chalk.green(t.name.padEnd(20))} ${chalk.dim(t.description)}`);
                        // Show variables
                        if (t.variables && t.variables.length > 0) {
                            const vars = t.variables.map((v: any) => 
                                v.required ? chalk.yellow(v.name) : chalk.dim(`${v.name}?`)
                            ).join(', ');
                            console.log(`      ${chalk.dim('Variables:')} ${vars}`);
                        }
                        console.log('');
                    }
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to list templates: ${msg}`));
                process.exit(1);
            }
        });

    scaffoldCmd
        .command('generate <template>')
        .description('Generate code from template')
        .option('--dry-run', 'Preview changes without writing files')
        .option('--force', 'Overwrite existing files')
        .option('-v, --var <variable...>', 'Variables (format: key=value)')
        .action(async (template: string, options: { dryRun?: boolean; force?: boolean; var?: string[] }) => {
            const spinner = ora('Generating code...').start();
            try {
                // Parse variables
                const variables: Record<string, string> = {};
                if (options.var) {
                    for (const v of options.var) {
                        const [key, value] = v.split('=');
                        if (key && value) {
                            variables[key] = value;
                        }
                    }
                }

                const result = await apiFetch<{ message: string; files: any[] }>('/scaffold', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        template,
                        variables,
                        preview: options.dryRun,
                        overwrite: options.force
                    })
                });

                spinner.succeed(chalk.green(result.message));

                if (result.files && result.files.length > 0) {
                    console.log(`\n${chalk.bold('Generated Files:')}`);
                    for (const file of result.files) {
                        console.log(`  ${chalk.cyan(file.path)}`);
                        if (options.dryRun) {
                            console.log(chalk.dim('\nPreview:'));
                            console.log(chalk.gray(file.content.substring(0, 200) + '...'));
                            console.log(chalk.dim('---'));
                        }
                    }
                }

            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed to generate code: ${msg}`));
                
                // Hint for missing variables
                if (msg.includes('Required variable missing')) {
                    console.log(chalk.yellow('\nTip: Provide variables using -v flag:'));
                    console.log(chalk.gray('  brunella dev scaffold generate react-component -v ComponentName=MyButton'));
                }
                
                process.exit(1);
            }
        });

    // ==================== P11: Approval Commands ====================

    const approval = dev.command('approval').description('Manage approval requests');

    approval
        .command('list')
        .description('List pending approval requests')
        .action(async () => {
            const spinner = ora('Fetching approval requests...').start();
            try {
                const result = await apiFetch<{ requests: any[] }>('/approval?status=pending');
                const { requests } = result;
                spinner.stop();

                if (requests.length === 0) {
                    console.log(chalk.dim('\nNo pending requests.'));
                    return;
                }

                console.log(chalk.bold('\nPending Approvals:\n'));
                for (const req of requests) {
                    console.log(`${chalk.cyan(req.id)} [${req.type}]`);
                    console.log(`  ${req.description}`);
                    const age = Math.round((Date.now() - req.createdAt) / 1000);
                    console.log(`  ${chalk.dim(`Created ${age}s ago`)}`);
                    console.log('');
                }
            } catch (e: unknown) {
                 const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed: ${msg}`));
                process.exit(1);
            }
        });

    approval
        .command('approve <id>')
        .description('Approve a request')
        .action(async (id: string) => {
            const spinner = ora(`Approving ${id}...`).start();
            try {
                const result = await apiFetch<{ success: boolean; status: string }>(`/approval/${id}/respond`, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'approve' })
                });
                spinner.succeed(chalk.green(`Request approved`));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                 spinner.fail(chalk.red(`Failed: ${msg}`));
                process.exit(1);
            }
        });

    approval
        .command('reject <id>')
        .description('Reject a request')
        .action(async (id: string) => {
             const spinner = ora(`Rejecting ${id}...`).start();
            try {
                const result = await apiFetch<{ success: boolean; status: string }>(`/approval/${id}/respond`, {
                     method: 'POST',
                    body: JSON.stringify({ action: 'reject' })
                });
                spinner.succeed(chalk.red(`Request rejected`));
            } catch (e: unknown) {
                 const msg = e instanceof Error ? e.message : String(e);
                spinner.fail(chalk.red(`Failed: ${msg}`));
                 process.exit(1);
            }
        });

    // ==================== P12: Activity Feed Commands ====================

    dev
        .command('feed')
        .description('Show activity feed')
        .option('-l, --limit <count>', 'Limit entries', '20')
        .option('--json', 'Output raw JSON')
        .option('-w, --watch', 'Watch mode (poll for new events)')
        .action(async (opts: { limit: string; json?: boolean; watch?: boolean }) => {
            try {
                const limit = parseInt(opts.limit) || 20;

                const fetchAndShow = async (lastId?: string) => {
                    const result = await apiFetch<{ activities: any[] }>(`/feed?limit=${limit}`);
                    // If watching, filter out old ones
                    const newItems = lastId 
                        ? result.activities.filter(a => a.id > lastId) // Simple lexicographical check or timestamp check needed? ID is random. 
                        // Actually ID is act-{timestamp}-{random}, so lexicographical might work for timestamp part, but safe to filter by timestamp or known IDs.
                        // For simplicity in CLI, just showing snapshot unless we implement smart dedupe.
                        // Let's rely on timestamp if watching.
                        : result.activities;

                    if (opts.json) {
                        console.log(JSON.stringify(newItems, null, 2));
                        return result.activities[0]?.id; // Return latest ID
                    }
                    
                    if (!lastId && !opts.watch) {
                        console.log(chalk.bold('\n📡 Activity Feed:\n'));
                    }

                    // Reverse to show oldest first in log stream, but for snapshot usually newest first
                    const itemsToShow = opts.watch ? newItems.reverse() : newItems;

                    for (const item of itemsToShow) {
                        const time = new Date(item.timestamp).toLocaleTimeString();
                        let badge = chalk.blue('INFO');
                        if (item.type === 'success') badge = chalk.green('DONE');
                        if (item.type === 'warning') badge = chalk.yellow('WARN');
                        if (item.type === 'error') badge = chalk.red('ERR ');
                        if (item.type === 'approval') badge = chalk.magenta('ASK ');

                        const source = chalk.dim(`[${item.source}]`);
                        console.log(`${chalk.dim(time)} ${badge} ${source} ${item.message}`);
                    }
                    
                    return result.activities[0]?.id || lastId; // Latest ID
                };

                const latestId = await fetchAndShow();

                if (opts.watch) {
                    console.log(chalk.dim('\nWatching for new activities... (Ctrl+C to stop)'));
                    // Use a simple Set to track seen IDs for deduplication in watch mode
                    const seenIds = new Set<string>();
                    // Prime with initial fetch
                    // (Actually the logic above is a bit simplistic for proper watch, 
                    // let's just re-fetch and filter by seenIds)
                    
                    // Reset seenIds with initial batch
                    // (We can't easily access the initial batch variable here due to scope, let's just start fresh loop)
                }
                
                if (opts.watch) {
                    const seen = new Set<string>();
                    // Add initial batch to seen
                    // We need to re-fetch to simplify logic or change structure.
                    // Let's keep it simple: just poll.
                    
                    setInterval(async () => {
                        const result = await apiFetch<{ activities: any[] }>(`/feed?limit=20`);
                        const newActivities = result.activities.filter(a => !seen.has(a.id)).reverse(); // Oldest first for streaming
                        
                        for (const item of newActivities) {
                             seen.add(item.id);
                             // ... print ...
                             const time = new Date(item.timestamp).toLocaleTimeString();
                             let badge = chalk.blue('INFO');
                             if (item.type === 'success') badge = chalk.green('DONE');
                             if (item.type === 'warning') badge = chalk.yellow('WARN');
                             if (item.type === 'error') badge = chalk.red('ERR ');
                             if (item.type === 'approval') badge = chalk.magenta('ASK ');
     
                             const source = chalk.dim(`[${item.source}]`);
                             console.log(`${chalk.dim(time)} ${badge} ${source} ${item.message}`);
                        }
                    }, 2000);
                    
                    // Prime the set with recent ones so we don't dump 20 old ones
                    const initial = await apiFetch<{ activities: any[] }>(`/feed?limit=${limit}`);
                    initial.activities.forEach(a => seen.add(a.id));
                }

            } catch (e: unknown) {
                 const msg = e instanceof Error ? e.message : String(e);
                console.error(chalk.red(`Failed: ${msg}`));
                 process.exit(1);
            }
        });

}
