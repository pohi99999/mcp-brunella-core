/**
 * test/coverage_analysis.test.ts — Unit tests for CoverageAnalyzer (P6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock logger
vi.mock('@packages/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn(),
}));
// Mock child_process
vi.mock('child_process', () => ({
    execFile: vi.fn((_cmd, _args, _opts, cb) => {
        cb(null, '', '');
    }),
}));
// Mock fs/promises
vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        readdir: vi.fn(),
        access: vi.fn(),
    },
}));
import fs from 'fs/promises';
import { CoverageAnalyzer } from '@packages/agents/coverageAnalysis.js';
const fsMock = vi.mocked(fs);
// ==================== Sample coverage-final.json structure ====================
function makeCoverageJson(files) {
    const result = {};
    for (const [filePath, config] of Object.entries(files)) {
        const stmtCount = config.stmtCount ?? 10;
        const coveredStmts = config.coveredStmts ?? stmtCount;
        const fnCount = config.fnCount ?? 3;
        const coveredFns = config.coveredFns ?? fnCount;
        const branchCount = config.branchCount ?? 2;
        const coveredBranches = config.coveredBranches ?? branchCount;
        // Build statement map and hits
        const statementMap = {};
        const s = {};
        for (let i = 0; i < stmtCount; i++) {
            statementMap[String(i)] = {
                start: { line: i + 1, column: 0 },
                end: { line: i + 1, column: 50 },
            };
            s[String(i)] = i < coveredStmts ? 1 : 0;
        }
        // Build function map and hits
        const fnMap = {};
        const f = {};
        for (let i = 0; i < fnCount; i++) {
            fnMap[String(i)] = { name: `fn${i}`, line: i + 1 };
            f[String(i)] = i < coveredFns ? 1 : 0;
        }
        // Build branch map and hits
        const branchMap = {};
        const b = {};
        for (let i = 0; i < branchCount; i++) {
            branchMap[String(i)] = { type: 'if', line: i + 1 };
            b[String(i)] = i < coveredBranches ? [1, 1] : [0, 0];
        }
        result[filePath] = { s, b, f, statementMap, branchMap, fnMap };
    }
    return JSON.stringify(result);
}
describe('CoverageAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        vi.clearAllMocks();
        analyzer = new CoverageAnalyzer('/project');
    });
    // ========== parseCoverageJson ==========
    describe('parseCoverageJson', () => {
        it('should parse valid coverage JSON', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/agents/myAgent.ts': {
                    stmtCount: 20, coveredStmts: 16,
                    fnCount: 5, coveredFns: 4,
                    branchCount: 3, coveredBranches: 2,
                },
                '/project/src/utils/helper.ts': {
                    stmtCount: 10, coveredStmts: 10,
                    fnCount: 2, coveredFns: 2,
                },
            }));
            // Mock readdir for untested files scan (empty src)
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            expect(summary.filesWithTests).toBe(2);
            expect(summary.aggregate.statements.total).toBe(30);
            expect(summary.aggregate.statements.covered).toBe(26);
            expect(summary.aggregate.statements.pct).toBe(87); // Math.round(26/30 * 100)
            expect(summary.files.length).toBe(2);
        });
        it('should compute 100% for metrics with zero total', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/empty.ts': {
                    stmtCount: 0, coveredStmts: 0,
                    fnCount: 0, coveredFns: 0,
                    branchCount: 0, coveredBranches: 0,
                },
            }));
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            const emptyFile = summary.files[0];
            expect(emptyFile.statements.pct).toBe(100);
            expect(emptyFile.branches.pct).toBe(100);
            expect(emptyFile.functions.pct).toBe(100);
        });
        it('should identify worst files sorted by line coverage', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/good.ts': { stmtCount: 10, coveredStmts: 9 },
                '/project/src/bad.ts': { stmtCount: 10, coveredStmts: 2 },
                '/project/src/mid.ts': { stmtCount: 10, coveredStmts: 5 },
            }));
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            expect(summary.worstFiles[0].relativePath).toContain('bad.ts');
            expect(summary.worstFiles[1].relativePath).toContain('mid.ts');
        });
        it('should return empty summary when file not found', async () => {
            fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
            const summary = await analyzer.parseCoverageJson('/project/coverage/missing.json');
            expect(summary.totalFiles).toBe(0);
            expect(summary.filesWithTests).toBe(0);
            expect(summary.aggregate.lines.pct).toBe(0);
        });
        it('should return empty summary for invalid JSON', async () => {
            fsMock.readFile.mockResolvedValueOnce('not valid json!!!');
            const summary = await analyzer.parseCoverageJson('/project/coverage/bad.json');
            expect(summary.totalFiles).toBe(0);
        });
        it('should compute uncovered lines correctly', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/partial.ts': {
                    stmtCount: 5, coveredStmts: 3,
                },
            }));
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            const file = summary.files[0];
            // Statements 0,1,2 are covered (hits=1), 3,4 are not (hits=0)
            // Lines 4 and 5 should be uncovered
            expect(file.uncoveredLines).toContain(4);
            expect(file.uncoveredLines).toContain(5);
            expect(file.uncoveredLines).not.toContain(1);
        });
        it('should respect worstFileLimit option', async () => {
            const files = {};
            for (let i = 0; i < 20; i++) {
                files[`/project/src/f${i}.ts`] = { stmtCount: 10, coveredStmts: i };
            }
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson(files));
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json', {
                worstFileLimit: 5,
            });
            expect(summary.worstFiles.length).toBe(5);
        });
        it('should exclude files matching exclude patterns', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/good.ts': { stmtCount: 10, coveredStmts: 10 },
                '/project/src/generated/auto.ts': { stmtCount: 10, coveredStmts: 1 },
            }));
            fsMock.readdir.mockResolvedValue([]);
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json', {
                exclude: ['generated'],
            });
            expect(summary.files.length).toBe(1);
            expect(summary.files[0].relativePath).not.toContain('generated');
        });
    });
    // ========== getLastSummary ==========
    describe('getLastSummary', () => {
        it('should return null when no coverage has been run', () => {
            expect(analyzer.getLastSummary()).toBeNull();
        });
        it('should cache the last summary after parsing', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({
                '/project/src/app.ts': { stmtCount: 10, coveredStmts: 8 },
            }));
            fsMock.readdir.mockResolvedValue([]);
            await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            const cached = analyzer.getLastSummary();
            expect(cached).not.toBeNull();
            expect(cached.filesWithTests).toBe(1);
        });
    });
    // ========== collectedAt timestamp ==========
    describe('timestamps', () => {
        it('should include collectedAt timestamp', async () => {
            fsMock.readFile.mockResolvedValueOnce(makeCoverageJson({}));
            fsMock.readdir.mockResolvedValue([]);
            const before = Date.now();
            const summary = await analyzer.parseCoverageJson('/project/coverage/coverage-final.json');
            expect(summary.collectedAt).toBeGreaterThanOrEqual(before);
            expect(summary.collectedAt).toBeLessThanOrEqual(Date.now());
        });
    });
});
