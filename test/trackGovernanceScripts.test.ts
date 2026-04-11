import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  auditTrackRepository,
  validateStagedTrackClosures,
} from '../scripts/lib/trackAudit.mjs';

const mainRepoRoot = process.cwd();
const hookProofScript = path.join(mainRepoRoot, 'scripts', 'hook-proof.mjs');

function writeText(repoRoot: string, relativePath: string, content: string): void {
  const absolutePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf-8');
}

function writeJson(repoRoot: string, relativePath: string, value: unknown): void {
  writeText(repoRoot, relativePath, JSON.stringify(value, null, 2));
}

function runGit(repoRoot: string, command: string): string {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runNode(repoRoot: string, scriptPath: string, args: string[]): string {
  return execFileSync('node', [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function recordProof(repoRoot: string, proofName: string): void {
  const proofDir = path.join(repoRoot, '.git', 'brunella-hook-proof');
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(
    path.join(proofDir, `${proofName}.json`),
    JSON.stringify(
      {
        timestamp: Date.now() + 1_000,
        recordedAt: new Date(Date.now() + 1_000).toISOString(),
        head: null,
      },
      null,
      2,
    ),
    'utf-8',
  );
}

function initRepo(repoRoot: string): void {
  runGit(repoRoot, 'git init');
  runGit(repoRoot, 'git config user.email "test@example.com"');
  runGit(repoRoot, 'git config user.name "Test User"');
}

describe('track governance scripts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'track-governance-'));
  });

  afterEach(() => {
    process.chdir(mainRepoRoot);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('flags meta-only staged closures', () => {
    initRepo(tempDir);

    writeText(tempDir, 'src/feature.ts', 'export const ready = false;\n');
    writeJson(tempDir, 'conductor/tracks/track-1/meta.json', {
      id: 'track-1',
      status: 'active',
      progress: 0,
      dod: {
        tests_pass: false,
        build_clean: false,
        code_committed: false,
        no_verify_used: false,
      },
    });
    runGit(tempDir, 'git add .');
    runGit(tempDir, 'git commit -m "chore: seed"');

    writeJson(tempDir, 'conductor/tracks/track-1/meta.json', {
      id: 'track-1',
      status: 'completed',
      progress: 100,
      completedAt: '2026-04-11T00:00:00Z',
      verificationNotes: 'Final verification complete.',
      dod: {
        tests_pass: true,
        build_clean: true,
        code_committed: true,
        no_verify_used: false,
      },
    });
    runGit(tempDir, 'git add conductor/tracks/track-1/meta.json');
    recordProof(tempDir, 'build');
    recordProof(tempDir, 'test-fast');

    const result = validateStagedTrackClosures({ repoRoot: tempDir });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('no implementation/test/documentation changes are staged alongside closure metadata'),
      ]),
    );
  });

  it('flags archived tracks with missing DoD evidence', () => {
    initRepo(tempDir);

    writeJson(tempDir, 'conductor/archive/track-2/meta.json', {
      id: 'track-2',
      status: 'archived',
      progress: 100,
      spec_status: 'draft',
    });
    runGit(tempDir, 'git add .');
    runGit(tempDir, 'git commit -m "chore: seed archive"');

    const report = auditTrackRepository({ repoRoot: tempDir });
    const track = report.tracks.find((item) => item.id === 'track-2');

    expect(track).toBeDefined();
    expect(track?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Missing required dod checklist'),
        expect.stringContaining('Archived track is missing archiveReason'),
        expect.stringContaining('spec_status=draft'),
      ]),
    );
  });

  it('accepts outgoing commits that have pre-commit proof', () => {
    initRepo(tempDir);

    writeText(tempDir, 'README.md', '# temp repo\n');
    runGit(tempDir, 'git add README.md');
    runNode(tempDir, hookProofScript, ['pre-commit']);
    runGit(tempDir, 'git commit -m "docs: add readme"');
    runNode(tempDir, hookProofScript, ['post-commit']);

    expect(() => runNode(tempDir, hookProofScript, ['pre-push'])).not.toThrow();
  });

  it('blocks outgoing commits without pre-commit proof', () => {
    initRepo(tempDir);

    writeText(tempDir, 'README.md', '# temp repo\n');
    runGit(tempDir, 'git add README.md');
    runGit(tempDir, 'git commit -m "docs: add readme"');
    runNode(tempDir, hookProofScript, ['post-commit']);

    expect(() => runNode(tempDir, hookProofScript, ['pre-push'])).toThrow();
  });
});
