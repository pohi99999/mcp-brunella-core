/**
 * LintFixerAgent - Mikro-ügynök ESLint hibák automatikus javítására
 *
 * Szerepkör: Karbantartó Raj (Maintenance Swarm) tagja
 * Modell: Qwen2.5-Coder-7B vagy kisebb (kód-specifikus feladatok)
 *
 * Feladatok:
 * - ESLint hibák detektálása
 * - Automatikus javítás (--fix)
 * - Javítási javaslatok generálása
 * - TypeScript típushibák elemzése
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

interface LintError {
    file: string;
    line: number;
    column: number;
    rule: string;
    severity: 'error' | 'warning';
    message: string;
    fixable: boolean;
}

interface LintReport {
    totalErrors: number;
    totalWarnings: number;
    fixableCount: number;
    errors: LintError[];
    files: string[];
}

interface FixResult {
    file: string;
    fixed: boolean;
    original: string;
    suggestion?: string;
    error?: string;
}

export default class LintFixerAgent implements IAgent {
    name = 'LintFixer';
    role = 'Karbantartó - ESLint hibák automatikus javítása';
    description = 'Mikro-ügynök ami detektálja és javítja az ESLint/TypeScript hibákat. Képes automatikus fix-re és javítási javaslatok generálására.';
    capabilities = [
        'lint_check',      // ESLint futtatás
        'auto_fix',        // Automatikus javítás
        'suggest_fix',     // Javítási javaslat
        'type_check',      // TypeScript check
        'batch_fix'        // Több fájl javítása
    ];

    private workspaceRoot: string;

    constructor() {
        this.workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
    }

    async execute(task: string, context?: unknown): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        const taskLower = task.toLowerCase();

        try {
            // Feladat routing
            if (taskLower.includes('check') || taskLower.includes('scan') || taskLower.includes('ellenőriz')) {
                return await this.runLintCheck(task);
            }

            if (taskLower.includes('fix') || taskLower.includes('javít')) {
                if (taskLower.includes('all') || taskLower.includes('mind')) {
                    return await this.fixAll();
                }
                // Specifikus fájl javítása
                const filePath = this.extractFilePath(task);
                if (filePath) {
                    return await this.fixFile(filePath);
                }
                return await this.fixAll();
            }

            if (taskLower.includes('suggest') || taskLower.includes('javaslat')) {
                const filePath = this.extractFilePath(task);
                if (filePath) {
                    return await this.suggestFix(filePath);
                }
            }

            if (taskLower.includes('type') || taskLower.includes('típus')) {
                return await this.runTypeCheck();
            }

            // Default: teljes lint check
            return await this.runLintCheck(task);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError(this.name, errorMsg);
            return {
                status: 'error',
                error: errorMsg
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    /**
     * ESLint check futtatása
     */
    private async runLintCheck(task: string): Promise<AgentResponse> {
        logInfo(this.name, 'ESLint check indítása...');

        const targetPath = this.extractFilePath(task) || 'src/';

        return new Promise((resolve) => {
            const args = [
                targetPath,
                '--format', 'json',
                '--ext', '.ts,.tsx,.js,.jsx'
            ];

            // Construct command string to avoid DEP0190 warning with shell: true
            const cmdArgs = ['eslint', ...args].map(arg => `"${arg}"`).join(' ');
            const command = `npx ${cmdArgs}`;

            const eslint = spawn(command, {
                cwd: this.workspaceRoot,
                shell: true
            });

            let stdout = '';
            let stderr = '';

            eslint.stdout.on('data', (data) => { stdout += data; });
            eslint.stderr.on('data', (data) => { stderr += data; });

            eslint.on('close', (code) => {
                try {
                    const results = JSON.parse(stdout || '[]');
                    const report = this.parseEslintResults(results);

                    if (report.totalErrors === 0 && report.totalWarnings === 0) {
                        resolve({
                            status: 'success',
                            data: {
                                message: '✅ Nincs ESLint hiba!',
                                report
                            }
                        });
                    } else {
                        resolve({
                            status: 'success',
                            data: {
                                message: `🔍 Találtam ${report.totalErrors} hibát és ${report.totalWarnings} figyelmeztetést`,
                                fixableCount: report.fixableCount,
                                report,
                                suggestion: report.fixableCount > 0
                                    ? `Futtasd: "lint fix all" - ${report.fixableCount} hiba automatikusan javítható`
                                    : 'Manuális javítás szükséges'
                            }
                        });
                    }
                } catch {
                    // Ha nem JSON (pl. nincs eslint), próbáljuk szövegként
                    resolve({
                        status: 'error',
                        error: stderr || 'ESLint futtatási hiba. Telepítve van? (npm install eslint)'
                    });
                }
            });
        });
    }

    /**
     * Automatikus javítás minden fájlra
     */
    private async fixAll(): Promise<AgentResponse> {
        logInfo(this.name, 'ESLint --fix futtatása...');

        return new Promise((resolve) => {
            const cmdArgs = ['eslint', 'src/', '--fix', '--ext', '.ts,.tsx,.js,.jsx'].map(arg => `"${arg}"`).join(' ');
            const command = `npx ${cmdArgs}`;
            
            const eslint = spawn(command, {
                cwd: this.workspaceRoot,
                shell: true
            });

            let stderr = '';
            eslint.stderr.on('data', (data) => { stderr += data; });

            eslint.on('close', async (code) => {
                // Újra ellenőrizzük mi maradt
                const checkResult = await this.runLintCheck('check src/');

                if (checkResult.status === 'success' && checkResult.data && typeof checkResult.data === 'object') {
                    const dataObj = checkResult.data as Record<string, unknown>;
                    const remaining = dataObj['report'] as LintReport;

                    resolve({
                        status: 'success',
                        data: {
                            message: '🔧 Automatikus javítás kész!',
                            remainingErrors: remaining.totalErrors,
                            remainingWarnings: remaining.totalWarnings,
                            note: remaining.totalErrors > 0
                                ? 'Néhány hiba manuális javítást igényel'
                                : 'Minden javítva!'
                        }
                    });
                } else {
                    resolve({
                        status: 'success',
                        data: {
                            message: '🔧 Fix lefutott',
                            warning: stderr || undefined
                        }
                    });
                }
            });
        });
    }

    /**
     * Egyetlen fájl javítása
     */
    private async fixFile(filePath: string): Promise<AgentResponse> {
        logInfo(this.name, `Fájl javítása: ${filePath}`);

        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.workspaceRoot, filePath);

        // Ellenőrizzük létezik-e
        try {
            await fs.access(fullPath);
        } catch {
            return {
                status: 'error',
                error: `Fájl nem található: ${filePath}`
            };
        }

        return new Promise((resolve) => {
            const cmdArgs = ['eslint', fullPath, '--fix'].map(arg => `"${arg}"`).join(' ');
            const command = `npx ${cmdArgs}`;

            const eslint = spawn(command, {
                cwd: this.workspaceRoot,
                shell: true
            });

            eslint.on('close', async () => {
                // Ellenőrizzük maradt-e hiba
                const checkResult = await this.runLintCheck(`check ${filePath}`);

                resolve({
                    status: 'success',
                    data: {
                        message: `✅ ${filePath} javítva`,
                        file: filePath,
                        checkResult: checkResult.data
                    }
                });
            });
        });
    }

    /**
     * Javítási javaslat generálása (LLM-mel)
     */
    private async suggestFix(filePath: string): Promise<AgentResponse> {
        logInfo(this.name, `Javítási javaslat: ${filePath}`);

        // Először nézzük meg mi a hiba
        const checkResult = await this.runLintCheck(`check ${filePath}`);

        if (checkResult.status !== 'success' || !checkResult.data || typeof checkResult.data !== 'object') {
            return checkResult;
        }

        const dataObj = checkResult.data as Record<string, unknown>;
        if (!dataObj['report']) {
            return checkResult;
        }

        const report = dataObj['report'] as LintReport;

        if (report.totalErrors === 0) {
            return {
                status: 'success',
                data: {
                    message: 'Nincs hiba ebben a fájlban!',
                    file: filePath
                }
            };
        }

        // Hibák összegyűjtése
        const errorSummary = report.errors
            .filter(e => e.file.includes(filePath))
            .map(e => `- Line ${e.line}: [${e.rule}] ${e.message}`)
            .join('\n');

        // Fájl tartalom beolvasása
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.workspaceRoot, filePath);

        let fileContent = '';
        try {
            fileContent = await fs.readFile(fullPath, 'utf-8');
        } catch {
            fileContent = '[Fájl nem olvasható]';
        }

        // Javaslat generálása (ezt később LLM-mel lehet bővíteni)
        const suggestions = this.generateFixSuggestions(report.errors.filter(e => e.file.includes(filePath)));

        return {
            status: 'success',
            data: {
                message: `📝 Javítási javaslatok: ${filePath}`,
                file: filePath,
                errors: errorSummary,
                suggestions,
                llmPrompt: this.buildLLMPrompt(filePath, fileContent, report.errors)
            }
        };
    }

    /**
     * TypeScript típusellenőrzés
     */
    private async runTypeCheck(): Promise<AgentResponse> {
        logInfo(this.name, 'TypeScript check indítása...');

        return new Promise((resolve) => {
            const cmdArgs = ['tsc', '--noEmit', '--pretty'].map(arg => `"${arg}"`).join(' ');
            const command = `npx ${cmdArgs}`;

            const tsc = spawn(command, {
                cwd: this.workspaceRoot,
                shell: true
            });

            let stdout = '';
            let stderr = '';

            tsc.stdout.on('data', (data) => { stdout += data; });
            tsc.stderr.on('data', (data) => { stderr += data; });

            tsc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        status: 'success',
                        data: {
                            message: '✅ TypeScript check OK - nincs típushiba!'
                        }
                    });
                } else {
                    // Parse TypeScript errors
                    const errors = this.parseTypeScriptErrors(stdout || stderr);

                    resolve({
                        status: 'success',
                        data: {
                            message: `❌ TypeScript hibák: ${errors.length} db`,
                            errors,
                            raw: stdout || stderr
                        }
                    });
                }
            });
        });
    }

    /**
     * ESLint JSON output parsing
     */
    private parseEslintResults(results: any[]): LintReport {
        const report: LintReport = {
            totalErrors: 0,
            totalWarnings: 0,
            fixableCount: 0,
            errors: [],
            files: []
        };

        for (const file of results) {
            if (file.errorCount > 0 || file.warningCount > 0) {
                report.files.push(file.filePath);
                report.totalErrors += file.errorCount;
                report.totalWarnings += file.warningCount;
                report.fixableCount += file.fixableErrorCount + file.fixableWarningCount;

                for (const msg of file.messages) {
                    report.errors.push({
                        file: file.filePath,
                        line: msg.line,
                        column: msg.column,
                        rule: msg.ruleId || 'unknown',
                        severity: msg.severity === 2 ? 'error' : 'warning',
                        message: msg.message,
                        fixable: !!msg.fix
                    });
                }
            }
        }

        return report;
    }

    /**
     * TypeScript error parsing
     */
    private parseTypeScriptErrors(output: string): Array<{file: string, line: number, message: string}> {
        const errors: Array<{file: string, line: number, message: string}> = [];
        const lines = output.split('\n');

        for (const line of lines) {
            // Pattern: src/file.ts(10,5): error TS2322: ...
            const match = line.match(/(.+)\((\d+),\d+\):\s*error\s*(TS\d+):\s*(.+)/);
            if (match) {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    message: `[${match[3]}] ${match[4]}`
                });
            }
        }

        return errors;
    }

    /**
     * Fix javaslatok generálása szabály alapján
     */
    private generateFixSuggestions(errors: LintError[]): string[] {
        const suggestions: string[] = [];
        const ruleToSuggestion: Record<string, string> = {
            'no-unused-vars': 'Töröld a nem használt változót, vagy használd `_` prefix-szel',
            '@typescript-eslint/no-unused-vars': 'Töröld vagy használd `_` prefix-szel',
            'no-console': 'Cseréld `logInfo()` vagy `logError()` hívásra (src/utils/logger.ts)',
            '@typescript-eslint/no-explicit-any': 'Adj meg konkrét típust vagy használj `unknown`-t',
            'prefer-const': 'Használj `const`-ot `let` helyett ha nem változik',
            'no-var': 'Használj `let` vagy `const` kulcsszót `var` helyett',
            'eqeqeq': 'Használj `===` operátort `==` helyett',
            'semi': 'Hiányzó pontosvessző',
            'quotes': 'Használj egységes idézőjeleket (single quotes)',
            'indent': 'Javítsd az indentálást',
            'no-multiple-empty-lines': 'Távolítsd el a felesleges üres sorokat'
        };

        const seenRules = new Set<string>();

        for (const error of errors) {
            if (!seenRules.has(error.rule)) {
                seenRules.add(error.rule);
                const suggestion = ruleToSuggestion[error.rule];
                if (suggestion) {
                    suggestions.push(`[${error.rule}]: ${suggestion}`);
                } else {
                    suggestions.push(`[${error.rule}]: Ellenőrizd az ESLint dokumentációt`);
                }
            }
        }

        return suggestions;
    }

    /**
     * LLM prompt építése javításhoz
     */
    private buildLLMPrompt(filePath: string, content: string, errors: LintError[]): string {
        const relevantErrors = errors.filter(e => e.file.includes(filePath));
        const errorList = relevantErrors
            .map(e => `- Line ${e.line}, Col ${e.column}: [${e.rule}] ${e.message}`)
            .join('\n');

        return `
Fix the following ESLint errors in ${filePath}:

ERRORS:
${errorList}

CURRENT CODE:
\`\`\`typescript
${content.slice(0, 2000)}${content.length > 2000 ? '\n// ... (truncated)' : ''}
\`\`\`

Provide the corrected code with minimal changes. Only fix the errors listed above.
        `.trim();
    }

    /**
     * Fájl útvonal kinyerése a taskból
     */
    private extractFilePath(task: string): string | null {
        // Keressünk .ts, .tsx, .js, .jsx fájlokat
        const patterns = [
            /["']([^"']+\.(ts|tsx|js|jsx))["']/,  // "file.ts" vagy 'file.ts'
            /\s(src\/[^\s]+\.(ts|tsx|js|jsx))/,    // src/path/file.ts
            /\s(\S+\.(ts|tsx|js|jsx))/             // bármilyen.ts
        ];

        for (const pattern of patterns) {
            const match = task.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }
}
