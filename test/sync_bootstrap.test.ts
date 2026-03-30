import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGeneratedBootstrapContent, syncBootstrapCopies } from '../scripts/sync_bootstrap.ts';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bas-bootstrap-sync-'));
}

function writeFile(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('sync_bootstrap', () => {
  it('prepends the generated banner to bootstrap content', () => {
    const generated = buildGeneratedBootstrapContent('# Demo\nSource text\n');

    expect(generated).toContain('GENERATED FILE - DO NOT EDIT DIRECTLY');
    expect(generated).toContain('# Demo');
    expect(generated).toContain('Source text');
  });

  it('syncs generated bootstrap copies from .ai/BOOTSTRAP.md', () => {
    const rootDir = createTempRoot();
    tempRoots.push(rootDir);

    writeFile(rootDir, path.join('.ai', 'BOOTSTRAP.md'), '# BAS\nSingle source\n');
    writeFile(rootDir, 'BOOTSTRAP.md', 'stale root copy');
    writeFile(rootDir, path.join('.vscode', 'BOOTSTRAP.md'), 'stale vscode copy');

    const results = syncBootstrapCopies({ rootDir });
    const rootCopy = fs.readFileSync(path.join(rootDir, 'BOOTSTRAP.md'), 'utf8');
    const vscodeCopy = fs.readFileSync(path.join(rootDir, '.vscode', 'BOOTSTRAP.md'), 'utf8');

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.changed)).toBe(true);
    expect(rootCopy).toContain('GENERATED FILE - DO NOT EDIT DIRECTLY');
    expect(rootCopy).toContain('Single source');
    expect(vscodeCopy).toBe(rootCopy);

    const checkResults = syncBootstrapCopies({ rootDir, check: true });
    expect(checkResults.every((result) => !result.changed)).toBe(true);
  });
});