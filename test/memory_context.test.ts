import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  discoverMemoryPaths,
  loadMemoryContent,
  getMemory
} from '../src/utils/memoryContext.js';

describe('Memory context', () => {
  it('discoverMemoryPaths returns empty when no files exist', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
    try {
      const paths = discoverMemoryPaths(tmp, {});
      assert.ok(Array.isArray(paths));
      assert.strictEqual(paths.length, 0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('discoverMemoryPaths finds BRUNELLA.md in cwd', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
    try {
      const file = path.join(tmp, 'BRUNELLA.md');
      fs.writeFileSync(file, '# Context\n', 'utf-8');
      const paths = discoverMemoryPaths(tmp, { fileName: 'BRUNELLA.md' });
      assert.ok(paths.length >= 1);
      assert.ok(paths.some((p) => p.endsWith('BRUNELLA.md')));
    } finally {
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
      assert.strictEqual(byPath.length, 2);
      assert.ok(combined.includes('--- ') && combined.includes(' ---'));
      assert.ok(combined.includes('content a') && combined.includes('content b'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('getMemory returns paths and combined from config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-mem-'));
    try {
      const file = path.join(tmp, 'BRUNELLA.md');
      fs.writeFileSync(file, 'hello memory', 'utf-8');
      const out = getMemory(tmp, { fileName: 'BRUNELLA.md' });
      assert.ok(Array.isArray(out.paths));
      assert.ok(typeof out.combined === 'string');
      assert.ok(out.byPath.length >= 1);
      assert.ok(out.combined.includes('hello memory'));
    } finally {
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
      assert.ok(combined.includes('imported content'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
