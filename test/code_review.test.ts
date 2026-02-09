import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    CodeReviewEngine,
    type ReviewResult,
    type ReviewSeverity,
} from '../src/agents/codeReview.js';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn(),
}));

// Mock llm_client
vi.mock('../src/core/llm_client.js', () => ({
    generateResponse: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
    },
}));

import { generateResponse } from '../src/core/llm_client.js';
import fs from 'fs/promises';

const mockGenerateResponse = vi.mocked(generateResponse);
const mockReadFile = vi.mocked(fs.readFile);

describe('CodeReviewEngine', () => {
    let engine: CodeReviewEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new CodeReviewEngine('github', 'gpt-4o');
    });

    describe('reviewFile', () => {
        it('should review a file and return structured findings', async () => {
            mockReadFile.mockResolvedValue('const x: any = 5;\nconsole.log(x);');
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [
                    { severity: 'warning', line: 1, message: 'Avoid using any type', rule: 'NO_ANY', suggestion: 'Use unknown or a specific type' },
                    { severity: 'warning', line: 2, message: 'Use logInfo instead of console.log', rule: 'NO_CONSOLE', suggestion: 'Import logInfo from logger.ts' },
                ],
                summary: 'Two convention violations found',
                score: 65,
            }));

            const result = await engine.reviewFile('/test/sample.ts');

            expect(result.fileName).toBe('sample.ts');
            expect(result.language).toBe('typescript');
            expect(result.score).toBe(65);
            expect(result.findings).toHaveLength(2);
            expect(result.findings[0].severity).toBe('warning');
            expect(result.findings[0].rule).toBe('NO_ANY');
            expect(result.stats.warning).toBe(2);
            expect(result.stats.total).toBe(2);
            expect(result.stats.critical).toBe(0);
            expect(result.summary).toBe('Two convention violations found');
            expect(result.reviewedAt).toBeGreaterThan(0);
        });

        it('should handle file read errors gracefully', async () => {
            mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

            await expect(engine.reviewFile('/nonexistent.ts'))
                .rejects.toThrow('Cannot read file: ENOENT: no such file');
        });

        it('should handle malformed LLM response', async () => {
            mockReadFile.mockResolvedValue('const x = 1;');
            mockGenerateResponse.mockResolvedValue('Not a valid JSON response at all');

            const result = await engine.reviewFile('/test/sample.ts');

            // Should fall back gracefully
            expect(result.score).toBe(50);
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].rule).toBe('PARSE_FALLBACK');
        });

        it('should clamp score between 0 and 100', async () => {
            mockReadFile.mockResolvedValue('const x = 1;');
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [],
                summary: 'Perfect',
                score: 150,
            }));

            const result = await engine.reviewFile('/test/sample.ts');
            expect(result.score).toBe(100);
        });

        it('should detect language from file extension', async () => {
            mockReadFile.mockResolvedValue('print("hello")');
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [],
                summary: 'OK',
                score: 90,
            }));

            const result = await engine.reviewFile('/test/sample.py');
            expect(result.language).toBe('python');
        });
    });

    describe('reviewCode', () => {
        it('should review inline code', async () => {
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [
                    { severity: 'info', message: 'Code looks clean' },
                ],
                summary: 'Clean code',
                score: 95,
            }));

            const result = await engine.reviewCode('const x = 1;', 'typescript', 'test.ts');

            expect(result.filePath).toBe('<inline>');
            expect(result.fileName).toBe('test.ts');
            expect(result.language).toBe('typescript');
            expect(result.score).toBe(95);
        });
    });

    describe('refactorFile', () => {
        it('should refactor a file with LLM and return changes', async () => {
            const original = 'const x: any = 5;\nconst y: any = 10;';
            const refactored = 'const x: number = 5;\nconst y: number = 10;';

            mockReadFile.mockResolvedValue(original);
            mockGenerateResponse.mockResolvedValue(`\`\`\`typescript\n${refactored}\n\`\`\``);

            const result = await engine.refactorFile('/test/sample.ts', 'Replace any with specific types');

            expect(result.originalCode).toBe(original);
            expect(result.refactoredCode).toBe(refactored);
            expect(result.instruction).toBe('Replace any with specific types');
            expect(result.changes.length).toBeGreaterThan(0);
            expect(result.refactoredAt).toBeGreaterThan(0);
        });

        it('should handle refactored code without markdown wrapping', async () => {
            mockReadFile.mockResolvedValue('const x = 1;');
            mockGenerateResponse.mockResolvedValue('const x: number = 1;');

            const result = await engine.refactorFile('/test/sample.ts', 'Add types');

            expect(result.refactoredCode).toBe('const x: number = 1;');
        });
    });

    describe('history', () => {
        it('should store reviews in history', async () => {
            mockReadFile.mockResolvedValue('const x = 1;');
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [],
                summary: 'Clean',
                score: 100,
            }));

            await engine.reviewFile('/test/a.ts');
            await engine.reviewFile('/test/b.ts');

            const history = engine.getHistory();
            expect(history).toHaveLength(2);
            // Most recent first
            expect(history[0].fileName).toBe('b.ts');
            expect(history[1].fileName).toBe('a.ts');
        });

        it('should limit history', async () => {
            const history = engine.getHistory(5);
            expect(history.length).toBeLessThanOrEqual(5);
        });
    });

    describe('getAggregateStats', () => {
        it('should return zeros when no reviews exist', () => {
            const stats = engine.getAggregateStats();
            expect(stats.totalReviews).toBe(0);
            expect(stats.avgScore).toBe(0);
            expect(stats.totalFindings).toBe(0);
        });

        it('should compute aggregate stats across reviews', async () => {
            mockReadFile.mockResolvedValue('code');
            mockGenerateResponse
                .mockResolvedValueOnce(JSON.stringify({
                    findings: [
                        { severity: 'critical', message: 'Security issue' },
                        { severity: 'warning', message: 'Perf issue' },
                    ],
                    summary: 'Issues found',
                    score: 40,
                }))
                .mockResolvedValueOnce(JSON.stringify({
                    findings: [
                        { severity: 'info', message: 'Style note' },
                    ],
                    summary: 'Minor issue',
                    score: 80,
                }));

            await engine.reviewFile('/test/a.ts');
            await engine.reviewFile('/test/b.ts');

            const stats = engine.getAggregateStats();
            expect(stats.totalReviews).toBe(2);
            expect(stats.avgScore).toBe(60); // (40+80)/2
            expect(stats.totalFindings).toBe(3);
            expect(stats.bySeverity.critical).toBe(1);
            expect(stats.bySeverity.warning).toBe(1);
            expect(stats.bySeverity.info).toBe(1);
        });
    });

    describe('severity validation', () => {
        it('should default invalid severity to info', async () => {
            mockReadFile.mockResolvedValue('code');
            mockGenerateResponse.mockResolvedValue(JSON.stringify({
                findings: [
                    { severity: 'invalid_severity', message: 'Something' },
                ],
                summary: 'Test',
                score: 50,
            }));

            const result = await engine.reviewFile('/test/sample.ts');
            expect(result.findings[0].severity).toBe('info');
        });
    });
});
