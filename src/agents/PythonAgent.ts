/**
 * PythonAgent.ts - Python Subsystem Guardian
 *
 * Part of Brunella 2.1 upgrade (MEDIUM priority task 2.2).
 * Monitors and manages the Python subsystem (myai), including:
 * - FastAPI health monitoring
 * - Python environment validation
 * - Dependency management
 * - Code execution
 * - Test running
 *
 * @module agents/PythonAgent
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { config } from '../config/index.js';
import { PythonShell } from '../utils/pythonShell.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SOURCE = 'PythonAgent';

// ============================================================================
// Types
// ============================================================================

export interface PythonEnvironment {
    pythonVersion: string;
    pythonPath: string;
    venvPath: string | null;
    venvActive: boolean;
    uvAvailable: boolean;
    pipVersion?: string;
}

export interface PythonDependency {
    name: string;
    requiredVersion: string;
    installedVersion: string | null;
    status: 'installed' | 'outdated' | 'missing';
}

export interface PythonHealthReport {
    timestamp: Date;
    environment: PythonEnvironment;
    apiStatus: 'healthy' | 'unhealthy' | 'unknown';
    apiLatencyMs?: number;
    dependencies: PythonDependency[];
    moduleStatus: ModuleStatus[];
    issues: PythonIssue[];
}

export interface ModuleStatus {
    module: string;
    path: string;
    importable: boolean;
    error?: string;
}

export interface PythonIssue {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'environment' | 'dependency' | 'api' | 'module';
    message: string;
    suggestion?: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check Python version and environment
 */
async function checkPythonEnvironment(): Promise<PythonEnvironment> {
    const venvPath = path.join(config.workspaceRoot, '.venv');
    const venvPython = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

    let pythonPath = 'python';
    let venvActive = false;

    try {
        await fs.access(venvPython);
        pythonPath = venvPython;
        venvActive = true;
    } catch {
        // No venv, use system python
    }

    let pythonVersion = 'unknown';
    try {
        const { stdout } = await execAsync(`"${pythonPath}" --version`);
        pythonVersion = stdout.trim().replace('Python ', '');
    } catch {
        // Python not found
    }

    let uvAvailable = false;
    try {
        await execAsync('uv --version');
        uvAvailable = true;
    } catch {
        // uv not installed
    }

    let pipVersion: string | undefined;
    try {
        const { stdout } = await execAsync(`"${pythonPath}" -m pip --version`);
        const match = stdout.match(/pip (\d+\.\d+\.?\d*)/);
        pipVersion = match ? match[1] : undefined;
    } catch {
        // pip not available
    }

    return {
        pythonVersion,
        pythonPath,
        venvPath: venvActive ? venvPath : null,
        venvActive,
        uvAvailable,
        pipVersion
    };
}

/**
 * Check Python FastAPI health
 */
async function checkPythonAPI(): Promise<{ status: 'healthy' | 'unhealthy' | 'unknown'; latencyMs?: number; error?: string }> {
    const apiUrl = process.env.BRUNELLA_PYTHON_API_URL || 'http://127.0.0.1:8000';
    const start = Date.now();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${apiUrl}/health`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            return { status: 'healthy', latencyMs };
        }

        return { status: 'unhealthy', latencyMs, error: `HTTP ${response.status}` };
    } catch (e) {
        return {
            status: 'unhealthy',
            error: e instanceof Error ? e.message : 'Connection failed'
        };
    }
}

/**
 * Check dependencies from pyproject.toml
 */
async function checkDependencies(env: PythonEnvironment): Promise<PythonDependency[]> {
    const dependencies: PythonDependency[] = [];
    const pyprojectPath = path.join(config.workspaceRoot, 'pyproject.toml');

    try {
        const content = await fs.readFile(pyprojectPath, 'utf-8');

        // Parse dependencies from pyproject.toml
        const depsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
        if (depsMatch) {
            const depsBlock = depsMatch[1];
            const depLines = depsBlock.match(/"([^"]+)"/g) || [];

            for (const depLine of depLines) {
                const dep = depLine.replace(/"/g, '');
                const match = dep.match(/^([a-zA-Z0-9_-]+)(?:>=|==|~=)?(.+)?$/);
                if (match) {
                    const name = match[1];
                    const requiredVersion = match[2] || '*';

                    // Check if installed
                    let installedVersion: string | null = null;
                    try {
                        const { stdout } = await execAsync(
                            `"${env.pythonPath}" -c "import ${name.replace('-', '_')}; print(getattr(${name.replace('-', '_')}, '__version__', 'unknown'))"`
                        );
                        installedVersion = stdout.trim();
                        if (installedVersion === 'unknown') {
                            // Try pip show
                            const pipResult = await execAsync(`"${env.pythonPath}" -m pip show ${name}`);
                            const versionMatch = pipResult.stdout.match(/Version:\s*(.+)/);
                            if (versionMatch) {
                                installedVersion = versionMatch[1].trim();
                            }
                        }
                    } catch {
                        installedVersion = null;
                    }

                    dependencies.push({
                        name,
                        requiredVersion,
                        installedVersion,
                        status: installedVersion ? 'installed' : 'missing'
                    });
                }
            }
        }
    } catch {
        // pyproject.toml not found or unreadable
    }

    return dependencies;
}

/**
 * Check Python module status
 */
async function checkModules(env: PythonEnvironment): Promise<ModuleStatus[]> {
    const myaiPath = path.join(config.workspaceRoot, 'myai');
    const coreModules = [
        'server.py',
        'browser_worker.py',
        'refiner_logic.py',
        'pydantic_models.py',
        'sync_to_r2.py'
    ];

    const modules: ModuleStatus[] = await Promise.all(coreModules.map(async (moduleName) => {
        const modulePath = path.join(myaiPath, moduleName);
        const moduleNameWithoutPy = moduleName.replace('.py', '');

        try {
            await fs.access(modulePath);

            // Try to syntax-check the module
            let importable = false;
            let error: string | undefined;

            try {
                await execAsync(
                    `"${env.pythonPath}" -c "import ast; ast.parse(open('${modulePath.replace(/\\/g, '/')}').read())"`,
                    { timeout: 10000 }
                );
                importable = true;
            } catch (e: unknown) {
                const err = e instanceof Error ? e.message : String(e);
                error = err.split('\n')[0]; // First line of error
            }

            return {
                module: moduleNameWithoutPy,
                path: modulePath,
                importable,
                error
            };
        } catch {
            return {
                module: moduleNameWithoutPy,
                path: modulePath,
                importable: false,
                error: 'Module file not found'
            };
        }
    }));

    return modules;
}

/**
 * Identify issues from health check results
 */
function identifyIssues(
    env: PythonEnvironment,
    apiStatus: 'healthy' | 'unhealthy' | 'unknown',
    dependencies: PythonDependency[],
    modules: ModuleStatus[]
): PythonIssue[] {
    const issues: PythonIssue[] = [];

    // Environment issues
    if (env.pythonVersion === 'unknown') {
        issues.push({
            severity: 'critical',
            type: 'environment',
            message: 'Python not found or not accessible',
            suggestion: 'Install Python 3.12+ and ensure it\'s in PATH'
        });
    } else {
        const [major, minor] = env.pythonVersion.split('.').map(Number);
        if (major < 3 || (major === 3 && minor < 12)) {
            issues.push({
                severity: 'medium',
                type: 'environment',
                message: `Python ${env.pythonVersion} is below recommended 3.12`,
                suggestion: 'Upgrade to Python 3.12+ for best compatibility'
            });
        }
    }

    if (!env.venvActive) {
        issues.push({
            severity: 'medium',
            type: 'environment',
            message: 'Virtual environment not found or not active',
            suggestion: 'Create venv with: python -m venv .venv && .venv\\Scripts\\activate'
        });
    }

    if (!env.uvAvailable) {
        issues.push({
            severity: 'low',
            type: 'environment',
            message: 'uv package manager not available',
            suggestion: 'Install uv for faster dependency management: pip install uv'
        });
    }

    // API issues
    if (apiStatus === 'unhealthy') {
        issues.push({
            severity: 'high',
            type: 'api',
            message: 'Python FastAPI server is not responding',
            suggestion: 'Start the server: cd myai && uvicorn server:app --port 8000'
        });
    }

    // Dependency issues
    const missingDeps = dependencies.filter(d => d.status === 'missing');
    if (missingDeps.length > 0) {
        issues.push({
            severity: 'high',
            type: 'dependency',
            message: `Missing dependencies: ${missingDeps.map(d => d.name).join(', ')}`,
            suggestion: env.uvAvailable ? 'Run: uv sync' : 'Run: pip install -r requirements.txt'
        });
    }

    // Module issues
    const brokenModules = modules.filter(m => !m.importable);
    if (brokenModules.length > 0) {
        issues.push({
            severity: 'high',
            type: 'module',
            message: `Broken modules: ${brokenModules.map(m => m.module).join(', ')}`,
            suggestion: 'Check module syntax and fix import errors'
        });
    }

    return issues;
}

/**
 * Generate markdown health report
 */
function generatePythonHealthReport(report: PythonHealthReport): string {
    const lines: string[] = [
        '# Python Subsystem Health Report',
        '',
        `**Timestamp:** ${report.timestamp.toISOString()}`,
        '',
        '## Environment',
        '',
        `| Property | Value |`,
        `|----------|-------|`,
        `| Python Version | ${report.environment.pythonVersion} |`,
        `| Python Path | \`${report.environment.pythonPath}\` |`,
        `| Virtual Env | ${report.environment.venvActive ? '✅ Active' : '❌ Not active'} |`,
        `| uv Available | ${report.environment.uvAvailable ? '✅ Yes' : '❌ No'} |`,
        `| pip Version | ${report.environment.pipVersion || 'N/A'} |`,
        ''
    ];

    // API Status
    const apiIcon = report.apiStatus === 'healthy' ? '🟢' : report.apiStatus === 'unhealthy' ? '🔴' : '⚪';
    lines.push('## FastAPI Status', '');
    lines.push(`${apiIcon} **${report.apiStatus.toUpperCase()}**`);
    if (report.apiLatencyMs) {
        lines.push(`- Latency: ${report.apiLatencyMs}ms`);
    }
    lines.push('');

    // Dependencies
    if (report.dependencies.length > 0) {
        lines.push('## Dependencies', '');
        lines.push('| Package | Required | Installed | Status |');
        lines.push('|---------|----------|-----------|--------|');
        for (const dep of report.dependencies) {
            const statusIcon = dep.status === 'installed' ? '✅' : dep.status === 'outdated' ? '🟡' : '❌';
            lines.push(`| ${dep.name} | ${dep.requiredVersion} | ${dep.installedVersion || '-'} | ${statusIcon} |`);
        }
        lines.push('');
    }

    // Modules
    if (report.moduleStatus.length > 0) {
        lines.push('## Core Modules', '');
        for (const mod of report.moduleStatus) {
            const icon = mod.importable ? '✅' : '❌';
            lines.push(`- ${icon} **${mod.module}**${mod.error ? ` - ${mod.error}` : ''}`);
        }
        lines.push('');
    }

    // Issues
    if (report.issues.length > 0) {
        lines.push('## ⚠️ Issues', '');
        for (const issue of report.issues) {
            const severityIcon = {
                critical: '🔴',
                high: '🟠',
                medium: '🟡',
                low: '🟢'
            }[issue.severity];
            lines.push(`${severityIcon} **[${issue.type.toUpperCase()}]** ${issue.message}`);
            if (issue.suggestion) {
                lines.push(`  - 💡 ${issue.suggestion}`);
            }
        }
        lines.push('');
    } else {
        lines.push('## ✅ No Issues Detected', '');
    }

    return lines.join('\n');
}

// ============================================================================
// Agent Implementation
// ============================================================================

export class PythonAgent implements IAgent {
    name = 'Python';
    role = 'Python Subsystem Guardian';
    description = 'Monitors and manages the Python subsystem (myai), including environment, dependencies, and FastAPI health';
    capabilities = [
        'python_health_check',
        'dependency_management',
        'code_execution',
        'environment_validation',
        'module_validation'
    ];

    private shell: PythonShell;
    private lastReport: PythonHealthReport | null = null;

    constructor() {
        this.shell = new PythonShell('myai/server.py');
    }

    async execute(task: string, context?: unknown): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        logInfo(SOURCE, `Executing: ${task}`);

        try {
            const taskLower = task.toLowerCase();

            // Parse commands
            if (taskLower.includes('help') || taskLower.includes('segítség')) {
                return this.showHelp();
            }

            if (taskLower.includes('health') || taskLower.includes('status') || taskLower.includes('állapot')) {
                return await this.runHealthCheck();
            }

            if (taskLower.includes('env') || taskLower.includes('environment') || taskLower.includes('környezet')) {
                return await this.checkEnvironment();
            }

            if (taskLower.includes('deps') || taskLower.includes('dependencies') || taskLower.includes('függőség')) {
                return await this.checkDeps();
            }

            if (taskLower.includes('sync') || taskLower.includes('install')) {
                return await this.syncDependencies();
            }

            if (taskLower.includes('execute') || taskLower.includes('run') || taskLower.includes('futtat')) {
                return await this.executeCode(task, context);
            }

            if (taskLower.includes('test') || taskLower.includes('teszt')) {
                return await this.runTests();
            }

            if (taskLower.includes('api') || taskLower.includes('fastapi')) {
                return await this.checkApiHealth();
            }

            // Default: run full health check
            return await this.runHealthCheck();

        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(SOURCE, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private showHelp(): AgentResponse {
        const help = `
# PythonAgent - Help

## Commands

| Command | Description |
|---------|-------------|
| \`health\` / \`status\` | Full health check |
| \`env\` / \`environment\` | Check Python environment |
| \`deps\` / \`dependencies\` | Check dependencies |
| \`sync\` / \`install\` | Sync/install dependencies |
| \`execute <code>\` | Execute Python code |
| \`test\` | Run Python tests |
| \`api\` / \`fastapi\` | Check FastAPI status |

## Examples

- \`python health\`
- \`python env\`
- \`python deps\`
- \`python sync\`
- \`python execute print("Hello")\`
- \`python test\`

## Environment

- **FastAPI URL:** http://127.0.0.1:8000
- **myai Path:** ${path.join(config.workspaceRoot, 'myai')}
`;

        return {
            status: 'success',
            data: { help }
        };
    }

    private async runHealthCheck(): Promise<AgentResponse> {
        logInfo(SOURCE, 'Running full health check...');

        const env = await checkPythonEnvironment();
        const apiResult = await checkPythonAPI();
        const dependencies = await checkDependencies(env);
        const modules = await checkModules(env);
        const issues = identifyIssues(env, apiResult.status, dependencies, modules);

        this.lastReport = {
            timestamp: new Date(),
            environment: env,
            apiStatus: apiResult.status,
            apiLatencyMs: apiResult.latencyMs,
            dependencies,
            moduleStatus: modules,
            issues
        };

        const report = generatePythonHealthReport(this.lastReport);

        logInfo(SOURCE, `Health check complete: ${issues.length} issues found`);

        return {
            status: 'success',
            data: {
                healthy: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
                issueCount: issues.length,
                report
            }
        };
    }

    private async checkEnvironment(): Promise<AgentResponse> {
        const env = await checkPythonEnvironment();
        return {
            status: 'success',
            data: { environment: env }
        };
    }

    private async checkDeps(): Promise<AgentResponse> {
        const env = await checkPythonEnvironment();
        const dependencies = await checkDependencies(env);
        return {
            status: 'success',
            data: {
                dependencies,
                missing: dependencies.filter(d => d.status === 'missing').map(d => d.name)
            }
        };
    }

    private async syncDependencies(): Promise<AgentResponse> {
        const env = await checkPythonEnvironment();

        try {
            if (env.uvAvailable) {
                logInfo(SOURCE, 'Syncing dependencies with uv...');
                const { stdout, stderr } = await execAsync('uv sync', {
                    cwd: config.workspaceRoot,
                    timeout: 120000
                });
                return {
                    status: 'success',
                    data: {
                        method: 'uv sync',
                        output: stdout,
                        warnings: stderr || undefined
                    }
                };
            } else {
                logInfo(SOURCE, 'Syncing dependencies with pip...');
                const { stdout, stderr } = await execAsync(
                    `"${env.pythonPath}" -m pip install -r requirements.txt`,
                    { cwd: config.workspaceRoot, timeout: 120000 }
                );
                return {
                    status: 'success',
                    data: {
                        method: 'pip install',
                        output: stdout,
                        warnings: stderr || undefined
                    }
                };
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            return {
                status: 'error',
                error: `Failed to sync dependencies: ${error}`
            };
        }
    }

    private async executeCode(task: string, context?: unknown): Promise<AgentResponse> {
        // Extract code from task
        const codeMatch = task.match(/(?:execute|run|futtat)\s+(.+)/is);
        if (!codeMatch) {
            return {
                status: 'error',
                error: 'No code provided. Usage: python execute <code>'
            };
        }

        const code = codeMatch[1].trim();
        logInfo(SOURCE, `Executing Python code: ${code.slice(0, 50)}...`);

        try {
            const result = await this.shell.run(code, context);
            return {
                status: 'success',
                data: { output: result }
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            return {
                status: 'error',
                error: `Execution failed: ${error}`
            };
        }
    }

    private async runTests(): Promise<AgentResponse> {
        const env = await checkPythonEnvironment();
        const myaiPath = path.join(config.workspaceRoot, 'myai');

        try {
            logInfo(SOURCE, 'Running Python tests...');
            const { stdout, stderr } = await execAsync(
                `"${env.pythonPath}" -m pytest -v`,
                { cwd: myaiPath, timeout: 120000 }
            );

            return {
                status: 'success',
                data: {
                    output: stdout,
                    warnings: stderr || undefined,
                    passed: !stderr?.includes('FAILED')
                }
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            // pytest exits with non-zero on failures, but still produces output
            if (error.includes('FAILED')) {
                return {
                    status: 'success',
                    data: {
                        output: error,
                        passed: false
                    }
                };
            }
            return {
                status: 'error',
                error: `Test run failed: ${error}`
            };
        }
    }

    private async checkApiHealth(): Promise<AgentResponse> {
        const result = await checkPythonAPI();
        return {
            status: 'success',
            data: {
                apiStatus: result.status,
                latencyMs: result.latencyMs,
                error: result.error
            }
        };
    }
}

// Export singleton instance
export const pythonAgent = new PythonAgent();
