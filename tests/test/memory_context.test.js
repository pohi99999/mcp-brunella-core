import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverMemoryPaths, loadMemoryContent, getMemory } from '@packages/utils/memoryContext.js';
describe('Memory context', () => {
    it('discoverMemoryPaths returns empty when no files exist', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
        try {
            const paths = discoverMemoryPaths(tmp, {});
            expect(Array.isArray(paths)).toBe(true);
            expect(paths.length).toBe(0);
        }
        finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
    it('discoverMemoryPaths finds BRUNELLA.md in cwd', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
        try {
            const file = path.join(tmp, 'BRUNELLA.md');
            fs.writeFileSync(file, '# Context\n', 'utf-8');
            const paths = discoverMemoryPaths(tmp, { fileName: 'BRUNELLA.md' });
            expect(paths.length).toBeGreaterThanOrEqual(1);
            expect(paths.some((p) => p.endsWith('BRUNELLA.md'))).toBe(true);
        }
        finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
    it('loadMemoryContent concatenates files with headers', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
        try {
            const f1 = path.join(tmp, 'a.md');
            const f2 = path.join(tmp, 'b.md');
            fs.writeFileSync(f1, 'content a', 'utf-8');
            fs.writeFileSync(f2, 'content b', 'utf-8');
            const { combined, byPath } = loadMemoryContent([f1, f2]);
            expect(byPath.length).toBe(2);
            expect(combined.includes('--- ') && combined.includes(' ---')).toBe(true);
            expect(combined.includes('content a') && combined.includes('content b')).toBe(true);
        }
        finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
    it('getMemory returns paths and combined from config', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
        try {
            const file = path.join(tmp, 'BRUNELLA.md');
            fs.writeFileSync(file, 'hello memory', 'utf-8');
            const out = getMemory(tmp, { fileName: 'BRUNELLA.md' });
            expect(Array.isArray(out.paths)).toBe(true);
            expect(typeof out.combined).toBe('string');
            expect(out.byPath.length).toBeGreaterThanOrEqual(1);
            expect(out.combined.includes('hello memory')).toBe(true);
        }
        finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
    it('loadMemoryContent resolves @imports when file exists', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
        try {
            const sub = path.join(tmp, 'sub');
            fs.mkdirSync(sub, { recursive: true });
            fs.writeFileSync(path.join(sub, 'extra.md'), 'imported content', 'utf-8');
            fs.writeFileSync(path.join(tmp, 'main.md'), 'main and @sub/extra.md', 'utf-8');
            const { combined } = loadMemoryContent([path.join(tmp, 'main.md')]);
            expect(combined.includes('imported content')).toBe(true);
        }
        finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
