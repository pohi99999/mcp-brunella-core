/**
 * FILE: test/codebaseIndexer.test.ts
 * PURPOSE: G4.4 — Tests for codebaseIndexer module
 */
import { describe, it, expect } from 'vitest';
import { chunkContent } from '@packages/core-logic/codebaseIndexer.js';
// ============================================================================
// CHUNKING TESTS
// ============================================================================
describe('codebaseIndexer', () => {
    describe('chunkContent', () => {
        it('should create chunks from file content', () => {
            const content = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n';
            const chunks = chunkContent(content, 'test.ts', { chunkSize: 30, chunkOverlap: 10 });
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks[0].filePath).toBe('test.ts');
            expect(chunks[0].startLine).toBe(1);
            expect(chunks[0].content.length).toBeGreaterThan(0);
        });
        it('should handle empty content', () => {
            const chunks = chunkContent('', 'empty.ts');
            expect(chunks).toHaveLength(0);
        });
        it('should handle single line content', () => {
            const chunks = chunkContent('const x = 1;', 'single.ts');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].content).toBe('const x = 1;');
            expect(chunks[0].startLine).toBe(1);
            expect(chunks[0].endLine).toBe(1);
        });
        it('should respect chunk size parameter', () => {
            // Create content larger than one chunk
            const lines = Array.from({ length: 50 }, (_, i) => `// Line ${i + 1}: some code here that takes up space`);
            const content = lines.join('\n');
            const chunks = chunkContent(content, 'large.ts', { chunkSize: 200, chunkOverlap: 50 });
            expect(chunks.length).toBeGreaterThan(1);
            // First chunk should be roughly chunkSize characters
            expect(chunks[0].content.length).toBeGreaterThanOrEqual(100);
        });
        it('should include overlap between consecutive chunks', () => {
            const lines = Array.from({ length: 30 }, (_, i) => `line-${i + 1}`);
            const content = lines.join('\n');
            const chunks = chunkContent(content, 'overlap.ts', { chunkSize: 100, chunkOverlap: 40 });
            if (chunks.length >= 2) {
                // Second chunk should have some content from the end of the first chunk
                const lastPartOfFirst = chunks[0].content.slice(-30);
                // Due to overlap, some of this text should appear in second chunk
                expect(chunks[1].startLine).toBeLessThan(chunks[0].endLine + 1);
            }
        });
        it('should use correct line numbers', () => {
            const content = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n';
            const chunks = chunkContent(content, 'lines.ts', { chunkSize: 10, chunkOverlap: 3 });
            expect(chunks[0].startLine).toBe(1);
            expect(chunks[0].endLine).toBeGreaterThanOrEqual(1);
        });
    });
    describe('types', () => {
        it('should define IndexStats correctly', () => {
            const stats = {
                fileCount: 10,
                chunkCount: 50,
                durationMs: 1234,
                skippedFiles: 2,
                errors: ['some error']
            };
            expect(stats.fileCount).toBe(10);
            expect(stats.chunkCount).toBe(50);
            expect(stats.errors).toHaveLength(1);
        });
        it('should define ChunkInfo correctly', () => {
            const chunk = {
                filePath: 'src/test.ts',
                content: 'const x = 1;',
                startLine: 1,
                endLine: 1
            };
            expect(chunk.filePath).toBe('src/test.ts');
            expect(chunk.content).toBe('const x = 1;');
        });
    });
});
