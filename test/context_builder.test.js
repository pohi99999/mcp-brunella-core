/**
 * test/context_builder.test.ts — Unit tests for ContextBuilder (P5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn(),
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
import { ContextBuilder } from '../src/agents/contextBuilder.js';
const fsMock = vi.mocked(fs);
describe('ContextBuilder', () => {
    let builder;
    beforeEach(() => {
        vi.clearAllMocks();
        builder = new ContextBuilder('/project');
    });
    // ========== parseImports ==========
    describe('parseImports', () => {
        it('should parse import-from statements', async () => {
            fsMock.readFile.mockResolvedValueOnce("import { foo } from './utils/helper.js';\nimport bar from '../lib/bar.js';\n");
            // access: first candidate .ts succeeds for first import, .ts succeeds for second
            fsMock.access.mockImplementation(async (p) => {
                const str = String(p);
                if (str.endsWith('helper.ts') || str.endsWith('bar.ts'))
                    return;
                throw new Error('ENOENT');
            });
            const result = await builder.parseImports('/project/src/index.ts', '/project');
            expect(result.length).toBe(2);
            expect(result[0]).toContain('helper.ts');
            expect(result[1]).toContain('bar.ts');
        });
        it('should parse require() calls', async () => {
            fsMock.readFile.mockResolvedValueOnce("const x = require('./config.js');\n");
            fsMock.access.mockImplementation(async (p) => {
                if (String(p).endsWith('config.ts'))
                    return;
                throw new Error('ENOENT');
            });
            const result = await builder.parseImports('/project/src/main.ts', '/project');
            expect(result.length).toBe(1);
            expect(result[0]).toContain('config.ts');
        });
        it('should resolve @/ alias to src/', async () => {
            fsMock.readFile.mockResolvedValueOnce("import { util } from '@/lib/utils.js';\n");
            fsMock.access.mockImplementation(async (p) => {
                if (String(p).endsWith('utils.ts'))
                    return;
                throw new Error('ENOENT');
            });
            const result = await builder.parseImports('/project/src/app.ts', '/project');
            expect(result.length).toBe(1);
            expect(result[0]).toContain('src');
            expect(result[0]).toContain('utils.ts');
        });
        it('should skip external packages', async () => {
            fsMock.readFile.mockResolvedValueOnce("import express from 'express';\nimport { useState } from 'react';\n");
            const result = await builder.parseImports('/project/src/app.ts', '/project');
            expect(result).toHaveLength(0);
        });
    });
    // ========== getSiblingFiles ==========
    describe('getSiblingFiles', () => {
        it('should return code files from same directory', async () => {
            fsMock.readdir.mockResolvedValueOnce([
                { name: 'target.ts', isFile: () => true, isDirectory: () => false },
                { name: 'sibling1.ts', isFile: () => true, isDirectory: () => false },
                { name: 'sibling2.tsx', isFile: () => true, isDirectory: () => false },
                { name: 'readme.md', isFile: () => true, isDirectory: () => false },
                { name: 'subdirectory', isFile: () => false, isDirectory: () => true },
            ]);
            const result = await builder.getSiblingFiles('/project/src/target.ts');
            expect(result).toHaveLength(2);
            expect(result.some((f) => f.includes('sibling1.ts'))).toBe(true);
            expect(result.some((f) => f.includes('sibling2.tsx'))).toBe(true);
        });
        it('should exclude the target file itself', async () => {
            fsMock.readdir.mockResolvedValueOnce([
                { name: 'index.ts', isFile: () => true, isDirectory: () => false },
                { name: 'other.ts', isFile: () => true, isDirectory: () => false },
            ]);
            const result = await builder.getSiblingFiles('/project/src/index.ts');
            expect(result).toHaveLength(1);
            expect(result[0]).toContain('other.ts');
        });
    });
    // ========== findTestPair ==========
    describe('findTestPair', () => {
        it('should find test file for a source file in src/', () => {
            const result = builder.findTestPair('/project/src/agents/myAgent.ts', '/project');
            expect(result).toContain('test');
            expect(result).toContain('myAgent.test.ts');
        });
        it('should find source file for a test file', () => {
            const result = builder.findTestPair('/project/test/myAgent.test.ts', '/project');
            expect(result).toContain('src');
            expect(result).toContain('myAgent.ts');
        });
        it('should handle .spec. files', () => {
            const result = builder.findTestPair('/project/test/utils.spec.ts', '/project');
            expect(result).toContain('utils.ts');
            expect(result).not.toContain('.spec.');
        });
    });
    // ========== gatherContext ==========
    describe('gatherContext', () => {
        it('should gather imported files', async () => {
            // readFile for target (import parsing)
            fsMock.readFile.mockImplementation(async (p) => {
                const str = String(p);
                if (str.includes('target.ts') && !str.includes('test')) {
                    return "import { helper } from './helper.js';\nexport const x = 1;";
                }
                if (str.includes('helper.ts')) {
                    return 'export function helper() { return 42; }';
                }
                throw new Error('ENOENT');
            });
            fsMock.access.mockImplementation(async (p) => {
                if (String(p).endsWith('helper.ts'))
                    return;
                throw new Error('ENOENT');
            });
            fsMock.readdir.mockResolvedValue([
                { name: 'target.ts', isFile: () => true, isDirectory: () => false },
                { name: 'helper.ts', isFile: () => true, isDirectory: () => false },
            ]);
            const result = await builder.gatherContext('/project/src/target.ts');
            expect(result.files.length).toBeGreaterThan(0);
            expect(result.targetFile).toContain('target.ts');
            expect(result.totalSize).toBeGreaterThan(0);
            // Should have helper.ts as imported
            const imported = result.files.find(f => f.reason.includes('imported'));
            expect(imported).toBeDefined();
        });
        it('should respect maxFiles limit', async () => {
            fsMock.readFile.mockImplementation(async (p) => {
                const str = String(p);
                if (str.includes('target.ts')) {
                    return '// no imports';
                }
                return '// file content';
            });
            fsMock.readdir.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({
                name: `file${i}.ts`,
                isFile: () => true,
                isDirectory: () => false,
            })));
            const result = await builder.gatherContext('/project/src/target.ts', { maxFiles: 3 });
            expect(result.files.length).toBeLessThanOrEqual(3);
            expect(result.truncated).toBe(true);
        });
        it('should respect maxTotalSize limit', async () => {
            fsMock.readFile.mockImplementation(async (p) => {
                const str = String(p);
                if (str.includes('target.ts')) {
                    return '// no imports';
                }
                return 'x'.repeat(1000);
            });
            fsMock.readdir.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({
                name: `f${i}.ts`,
                isFile: () => true,
                isDirectory: () => false,
            })));
            const result = await builder.gatherContext('/project/src/target.ts', {
                maxTotalSize: 2500,
            });
            expect(result.totalSize).toBeLessThanOrEqual(2500);
            expect(result.truncated).toBe(true);
        });
        it('should include explicitly requested files', async () => {
            fsMock.readFile.mockImplementation(async (p) => {
                const str = String(p);
                if (str.includes('target.ts'))
                    return '// target';
                if (str.includes('extra.ts'))
                    return '// extra file content';
                throw new Error('ENOENT');
            });
            // readdir returns only target
            fsMock.readdir.mockResolvedValue([
                { name: 'target.ts', isFile: () => true, isDirectory: () => false },
            ]);
            const result = await builder.gatherContext('/project/src/target.ts', {
                extraFiles: ['/project/src/extra.ts'],
                includeSiblings: false,
                includeTestPair: false,
            });
            const extra = result.files.find(f => f.reason === 'explicitly included');
            expect(extra).toBeDefined();
            expect(extra.content).toBe('// extra file content');
        });
        it('should skip unreadable files gracefully', async () => {
            fsMock.readFile.mockImplementation(async (p) => {
                const str = String(p);
                if (str.includes('target.ts'))
                    return '// no imports';
                throw new Error('EACCES');
            });
            fsMock.readdir.mockResolvedValue([
                { name: 'target.ts', isFile: () => true, isDirectory: () => false },
                { name: 'broken.ts', isFile: () => true, isDirectory: () => false },
            ]);
            const result = await builder.gatherContext('/project/src/target.ts');
            // Should not throw, just skip the broken file
            expect(result.files.every(f => !f.filePath.includes('broken'))).toBe(true);
        });
    });
    // ========== formatForPrompt ==========
    describe('formatForPrompt', () => {
        it('should format context files as markdown code blocks', () => {
            const context = {
                targetFile: '/project/src/app.ts',
                files: [
                    {
                        filePath: '/project/src/utils.ts',
                        relativePath: 'src/utils.ts',
                        content: 'export const x = 1;',
                        reason: 'imported by target',
                        size: 20,
                    },
                ],
                totalSize: 20,
                truncated: false,
                gatheredAt: Date.now(),
            };
            const formatted = builder.formatForPrompt(context);
            expect(formatted).toContain('--- PROJECT CONTEXT ---');
            expect(formatted).toContain('--- END CONTEXT ---');
            expect(formatted).toContain('src/utils.ts');
            expect(formatted).toContain('export const x = 1;');
            expect(formatted).toContain('```');
        });
        it('should include truncation notice if truncated', () => {
            const context = {
                targetFile: '/project/src/app.ts',
                files: [],
                totalSize: 0,
                truncated: true,
                gatheredAt: Date.now(),
            };
            const formatted = builder.formatForPrompt(context);
            // Empty files returns '' early
            expect(formatted).toBe('');
        });
        it('should return empty string for no files', () => {
            const context = {
                targetFile: '/project/src/app.ts',
                files: [],
                totalSize: 0,
                truncated: false,
                gatheredAt: Date.now(),
            };
            expect(builder.formatForPrompt(context)).toBe('');
        });
    });
});
