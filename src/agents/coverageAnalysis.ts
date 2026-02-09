// FILE: src/agents/coverageAnalysis.ts
// PURPOSE: Test Coverage Analysis for Developer Agent 3.0 (P6)
// VERSION: 3.0
//
// Analyzes test coverage across the project by:
//   1. Running vitest with --coverage flags programmatically
//   2. Parsing coverage JSON output
//   3. Computing per-file and aggregate metrics
//   4. Identifying uncovered files / functions

import { logInfo, logError } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ==================== Types ====================

export interface FileCoverage {
    filePath: string;
    relativePath: string;
    statements: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
    lines: CoverageMetric;
    uncoveredLines: number[];
}

export interface CoverageMetric {
    total: number;
    covered: number;
    pct: number; // 0-100
}

export interface CoverageSummary {
    totalFiles: number;
    filesWithTests: number;
    filesWithoutTests: number;
    aggregate: {
        statements: CoverageMetric;
        branches: CoverageMetric;
        functions: CoverageMetric;
        lines: CoverageMetric;
    };
    files: FileCoverage[];
    /** Files sorted by coverage (lowest first) */
    worstFiles: FileCoverage[];
    /** Source files that have no corresponding test */
    untestedFiles: string[];
    collectedAt: number;
}

export interface CoverageOptions {
    /** Specific files or patterns to cover */
    include?: string[];
    /** Files to exclude */
    exclude?: string[];
    /** Max number of "worst files" to return (default: 10) */
    worstFileLimit?: number;
    /** Project root */
    projectRoot?: string;
}

// ==================== Constants ====================

const COVERAGE_JSON_PATH = 'coverage/coverage-final.json';
const DEFAULT_WORST_FILE_LIMIT = 10;

const SOURCE_DIRS = ['src'];
const TEST_DIR = 'test';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_PATTERNS = [
    /\.d\.ts$/,
    /index\.ts$/,
    /types\.ts$/,
    /node_modules/,
    /build\//,
    /dist\//,
];

// ==================== Coverage Analyzer ====================

export class CoverageAnalyzer {
    private projectRoot: string;
    private lastSummary: CoverageSummary | null = null;

    constructor(projectRoot?: string) {
        this.projectRoot = projectRoot || process.cwd();
    }

    /**
     * Run vitest coverage and return parsed summary.
     */
    async runCoverage(options: CoverageOptions = {}): Promise<CoverageSummary> {
        const root = options.projectRoot ?? this.projectRoot;

        logInfo('CoverageAnalyzer', 'Running test coverage analysis...');

        // Step 1: Run vitest with coverage
        try {
            const args = [
                'vitest', 'run',
                '--coverage',
                '--coverage.provider=v8',
                '--coverage.reporter=json',
                '--reporter=verbose',
            ];

            if (options.include && options.include.length > 0) {
                args.push(...options.include);
            }

            await execFileAsync('npx', args, {
                cwd: root,
                timeout: 120_000,
                env: { ...process.env, NODE_ENV: 'test' },
            });
        } catch (e: unknown) {
            // vitest might exit non-zero if tests fail, but coverage is still collected
            const msg = e instanceof Error ? e.message : String(e);
            if (!msg.includes('coverage')) {
                logInfo('CoverageAnalyzer', `Tests had failures but coverage collected: ${msg.slice(0, 200)}`);
            }
        }

        // Step 2: Parse coverage JSON
        const coveragePath = path.join(root, COVERAGE_JSON_PATH);
        return this.parseCoverageJson(coveragePath, options);
    }

    /**
     * Parse an existing coverage-final.json without re-running tests.
     */
    async parseCoverageJson(
        coveragePath: string,
        options: CoverageOptions = {}
    ): Promise<CoverageSummary> {
        const root = options.projectRoot ?? this.projectRoot;
        const worstLimit = options.worstFileLimit ?? DEFAULT_WORST_FILE_LIMIT;

        let rawJson: string;
        try {
            rawJson = await fs.readFile(coveragePath, 'utf-8');
        } catch {
            logError('CoverageAnalyzer', `Coverage file not found: ${coveragePath}`);
            return this.emptySummary();
        }

        let coverageData: Record<string, unknown>;
        try {
            coverageData = JSON.parse(rawJson) as Record<string, unknown>;
        } catch {
            logError('CoverageAnalyzer', 'Failed to parse coverage JSON');
            return this.emptySummary();
        }

        // Step 3: Build per-file coverage
        const files: FileCoverage[] = [];
        const aggregateStatements = { total: 0, covered: 0 };
        const aggregateBranches = { total: 0, covered: 0 };
        const aggregateFunctions = { total: 0, covered: 0 };
        const aggregateLines = { total: 0, covered: 0 };

        for (const [filePath, data] of Object.entries(coverageData)) {
            const fileData = data as Record<string, unknown>;
            const relPath = path.relative(root, filePath);

            // Apply exclusions
            if (options.exclude?.some(pattern => relPath.includes(pattern))) continue;
            if (SKIP_PATTERNS.some(p => p.test(relPath))) continue;

            const stmtMap = (fileData.s ?? {}) as Record<string, number>;
            const branchMap = (fileData.b ?? {}) as Record<string, number[]>;
            const fnMap = (fileData.f ?? {}) as Record<string, number>;
            const stmtInfo = (fileData.statementMap ?? {}) as Record<string, unknown>;
            const branchInfo = (fileData.branchMap ?? {}) as Record<string, unknown>;
            const fnInfo = (fileData.fnMap ?? {}) as Record<string, unknown>;

            const stmtTotal = Object.keys(stmtInfo).length;
            const stmtCovered = Object.values(stmtMap).filter(v => v > 0).length;
            const branchTotal = Object.values(branchInfo).length;
            const branchCovered = Object.values(branchMap)
                .filter((counts: number[]) => counts.every(c => c > 0)).length;
            const fnTotal = Object.keys(fnInfo).length;
            const fnCovered = Object.values(fnMap).filter(v => v > 0).length;

            // Compute line coverage from statements
            const lineMap = new Map<number, boolean>();
            for (const [key, loc] of Object.entries(stmtInfo)) {
                const location = loc as { start: { line: number }; end: { line: number } };
                const hit = stmtMap[key] > 0;
                for (let l = location.start.line; l <= location.end.line; l++) {
                    if (!lineMap.has(l) || hit) lineMap.set(l, hit);
                }
            }
            const lineTotal = lineMap.size;
            const lineCovered = [...lineMap.values()].filter(Boolean).length;
            const uncoveredLines = [...lineMap.entries()]
                .filter(([, hit]) => !hit)
                .map(([line]) => line)
                .sort((a, b) => a - b);

            const fc: FileCoverage = {
                filePath,
                relativePath: relPath,
                statements: {
                    total: stmtTotal,
                    covered: stmtCovered,
                    pct: stmtTotal > 0 ? Math.round((stmtCovered / stmtTotal) * 100) : 100,
                },
                branches: {
                    total: branchTotal,
                    covered: branchCovered,
                    pct: branchTotal > 0 ? Math.round((branchCovered / branchTotal) * 100) : 100,
                },
                functions: {
                    total: fnTotal,
                    covered: fnCovered,
                    pct: fnTotal > 0 ? Math.round((fnCovered / fnTotal) * 100) : 100,
                },
                lines: {
                    total: lineTotal,
                    covered: lineCovered,
                    pct: lineTotal > 0 ? Math.round((lineCovered / lineTotal) * 100) : 100,
                },
                uncoveredLines,
            };

            files.push(fc);

            aggregateStatements.total += stmtTotal;
            aggregateStatements.covered += stmtCovered;
            aggregateBranches.total += branchTotal;
            aggregateBranches.covered += branchCovered;
            aggregateFunctions.total += fnTotal;
            aggregateFunctions.covered += fnCovered;
            aggregateLines.total += lineTotal;
            aggregateLines.covered += lineCovered;
        }

        // Step 4: Find untested source files
        const untestedFiles = await this.findUntestedFiles(root, files);

        // Step 5: Sort and slice worst files
        const worstFiles = [...files]
            .sort((a, b) => a.lines.pct - b.lines.pct)
            .slice(0, worstLimit);

        const pct = (covered: number, total: number) =>
            total > 0 ? Math.round((covered / total) * 100) : 100;

        const summary: CoverageSummary = {
            totalFiles: files.length + untestedFiles.length,
            filesWithTests: files.length,
            filesWithoutTests: untestedFiles.length,
            aggregate: {
                statements: {
                    total: aggregateStatements.total,
                    covered: aggregateStatements.covered,
                    pct: pct(aggregateStatements.covered, aggregateStatements.total),
                },
                branches: {
                    total: aggregateBranches.total,
                    covered: aggregateBranches.covered,
                    pct: pct(aggregateBranches.covered, aggregateBranches.total),
                },
                functions: {
                    total: aggregateFunctions.total,
                    covered: aggregateFunctions.covered,
                    pct: pct(aggregateFunctions.covered, aggregateFunctions.total),
                },
                lines: {
                    total: aggregateLines.total,
                    covered: aggregateLines.covered,
                    pct: pct(aggregateLines.covered, aggregateLines.total),
                },
            },
            files,
            worstFiles,
            untestedFiles,
            collectedAt: Date.now(),
        };

        this.lastSummary = summary;
        logInfo('CoverageAnalyzer', `Coverage: ${summary.aggregate.lines.pct}% lines (${files.length} files)`);
        return summary;
    }

    /**
     * Get last computed summary (without re-running).
     */
    getLastSummary(): CoverageSummary | null {
        return this.lastSummary;
    }

    // ==================== Private Helpers ====================

    private async findUntestedFiles(root: string, coveredFiles: FileCoverage[]): Promise<string[]> {
        const coveredPaths = new Set(coveredFiles.map(f => f.relativePath));
        const untested: string[] = [];

        for (const srcDir of SOURCE_DIRS) {
            try {
                await this.walkForUntested(
                    path.join(root, srcDir),
                    root,
                    coveredPaths,
                    untested
                );
            } catch {
                // src dir might not exist
            }
        }

        // Check if test files exist for each untested source
        const testDir = path.join(root, TEST_DIR);
        const truly: string[] = [];

        for (const srcFile of untested) {
            const ext = path.extname(srcFile);
            const base = path.basename(srcFile, ext);
            const testFile = path.join(testDir, `${base}.test${ext}`);

            try {
                await fs.access(testFile);
                // Test exists but file wasn't in coverage → might still be covered indirectly
            } catch {
                truly.push(srcFile);
            }
        }

        return truly;
    }

    private async walkForUntested(
        dir: string,
        root: string,
        coveredPaths: Set<string>,
        result: string[]
    ): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                await this.walkForUntested(fullPath, root, coveredPaths, result);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (!SOURCE_EXTENSIONS.has(ext)) continue;
                if (SKIP_PATTERNS.some(p => p.test(entry.name))) continue;
                if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;

                const relPath = path.relative(root, fullPath);
                if (!coveredPaths.has(relPath)) {
                    result.push(relPath);
                }
            }
        }
    }

    private emptySummary(): CoverageSummary {
        const zero: CoverageMetric = { total: 0, covered: 0, pct: 0 };
        return {
            totalFiles: 0,
            filesWithTests: 0,
            filesWithoutTests: 0,
            aggregate: {
                statements: { ...zero },
                branches: { ...zero },
                functions: { ...zero },
                lines: { ...zero },
            },
            files: [],
            worstFiles: [],
            untestedFiles: [],
            collectedAt: Date.now(),
        };
    }
}

// Singleton
export const coverageAnalyzer = new CoverageAnalyzer();
