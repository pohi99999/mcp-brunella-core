/**
 * P8 Git Integration Tests
 * Tests GitManager functionality including:
 * - Git status retrieval (branch, staged/unstaged/untracked files)
 * - Diff operations (file diff, staged diff)
 * - Stage/unstage operations
 * - Commit creation
 * - Push/pull operations
 * - Branch management (list, create, checkout, delete)
 * - Commit log retrieval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger first
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Use vi.hoisted to create mock that can be used in factory
const { mockExecAsyncFn } = vi.hoisted(() => ({
  mockExecAsyncFn: vi.fn()
}));

vi.mock('node:util', async () => {
  const actual = await vi.importActual<typeof import('node:util')>('node:util');
  return {
    ...actual,
    promisify: () => mockExecAsyncFn,
  };
});

// Import GitManager after mocks
import { GitManager } from '../src/agents/gitIntegration.js';

describe('GitManager - P8 Git Integration', () => {
  let gitManager: GitManager;

  beforeEach(() => {
    vi.clearAllMocks();
    gitManager = new GitManager('/fake/workspace');
    mockExecAsyncFn.mockReset();
  });

  // ==================== Git Status ====================

  it('should get git status with branch and files', async () => {
    // Mock git commands
    mockExecAsyncFn
      .mockResolvedValueOnce({ stdout: 'main', stderr: '' }) // rev-parse --abbrev-ref HEAD
      .mockResolvedValueOnce({ stdout: 'origin/main', stderr: '' }) // rev-parse upstream
      .mockResolvedValueOnce({ stdout: '0\t0', stderr: '' }) // rev-list ahead/behind
      .mockResolvedValueOnce({ stdout: ' M file1.ts\nA  file2.ts\n?? file3.ts', stderr: '' }); // status --porcelain

    const status = await gitManager.getStatus();

    expect(status.branch).toBe('main');
    expect(status.remote).toBe('origin/main');
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.files.length).toBe(3);
    expect(status.staged.length).toBe(1); // file2.ts (A)
    expect(status.unstaged.length).toBe(1); // file1.ts (M)
    expect(status.untracked.length).toBe(1); // file3.ts (??)
    expect(status.hasChanges).toBe(true);
  });

  it('should handle no upstream branch', async () => {
    mockExecAsyncFn
      .mockResolvedValueOnce({ stdout: 'feature-branch', stderr: '' })
      .mockRejectedValueOnce(new Error('no upstream')) // No upstream branch
      .mockResolvedValueOnce({ stdout: '', stderr: '' }); // status --porcelain (clean)

    const status = await gitManager.getStatus();

    expect(status.branch).toBe('feature-branch');
    expect(status.remote).toBeUndefined();
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.hasChanges).toBe(false);
  });

  // ==================== Git Diff ====================

  it('should get diff for a specific file', async () => {
    const diffOutput = `diff --git a/src/test.ts b/src/test.ts
index 1234567..8901234 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,4 @@
+import { foo } from 'bar';
 export function test() {
-  return 1;
+  return 2;
 }`;

    mockExecAsyncFn.mockResolvedValueOnce({ stdout: diffOutput, stderr: '' });

    const diffs = await gitManager.getDiff('src/test.ts', false);

    expect(diffs.length).toBe(1);
    expect(diffs[0].file).toBe('src/test.ts');
    expect(diffs[0].additions).toBeGreaterThan(0);
    expect(diffs[0].deletions).toBeGreaterThan(0);
    expect(diffs[0].hunks.length).toBeGreaterThan(0);
  });

  it('should return empty array for no diff', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const diffs = await gitManager.getDiff();

    expect(diffs.length).toBe(0);
  });

  // ==================== Stage/Unstage ====================

  it('should stage files', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.stageFiles(['file1.ts', 'file2.ts']);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git add "file1.ts" "file2.ts"'),
      expect.any(Object)
    );
  });

  it('should throw error when staging no files', async () => {
    await expect(gitManager.stageFiles([])).rejects.toThrow('No files to stage');
  });

  it('should unstage files', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.unstageFiles(['file1.ts']);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git reset HEAD "file1.ts"'),
      expect.any(Object)
    );
  });

  // ==================== Commit ====================

  it('should commit staged changes', async () => {
    const commitOutput = `[main 1234567] test commit
 2 files changed, 10 insertions(+), 3 deletions(-)`;

    mockExecAsyncFn.mockResolvedValueOnce({ stdout: commitOutput, stderr: '' });

    const result = await gitManager.commit('test commit');

    expect(result.hash).toBe('1234567');
    expect(result.message).toBe('test commit');
    expect(result.filesChanged).toBe(2);
    expect(result.insertions).toBe(10);
    expect(result.deletions).toBe(3);
  });

  it('should throw error for empty commit message', async () => {
    await expect(gitManager.commit('')).rejects.toThrow('Commit message cannot be empty');
  });

  // ==================== Push ====================

  it('should push to remote', async () => {
    mockExecAsyncFn
      .mockResolvedValueOnce({ stdout: 'main', stderr: '' }) // rev-parse branch
      .mockResolvedValueOnce({ stdout: 'success', stderr: '' }); // push

    const result = await gitManager.push('origin', 'main');

    expect(result.success).toBe(true);
    expect(result.branch).toBe('main');
    expect(result.remote).toBe('origin');
  });

  it('should handle push failure', async () => {
    mockExecAsyncFn
      .mockResolvedValueOnce({ stdout: 'main', stderr: '' })
      .mockRejectedValueOnce(new Error('Push rejected'));

    const result = await gitManager.push();

    expect(result.success).toBe(false);
    expect(result.message).toContain('Push rejected');
  });

  // ==================== Branches ====================

  it('should list branches', async () => {
    const branchOutput = `* main                1234567 [origin/main] Latest commit
  feature-branch      8901234 Feature work`;

    mockExecAsyncFn.mockResolvedValueOnce({ stdout: branchOutput, stderr: '' });

    const branches = await gitManager.listBranches(false);

    expect(branches.length).toBeGreaterThanOrEqual(2);
    const mainBranch = branches.find(b => b.name === 'main');
    expect(mainBranch).toBeDefined();
    expect(mainBranch?.current).toBe(true);
    expect(mainBranch?.remote).toContain('origin/main');
  });

  it('should create a new branch', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.createBranch('new-feature', false);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git branch new-feature'),
      expect.any(Object)
    );
  });

  it('should create and checkout a new branch', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.createBranch('new-feature', true);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git checkout -b new-feature'),
      expect.any(Object)
    );
  });

  it('should checkout existing branch', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.checkoutBranch('feature-branch');

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git checkout feature-branch'),
      expect.any(Object)
    );
  });

  it('should delete branch', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.deleteBranch('old-feature', false);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git branch -d old-feature'),
      expect.any(Object)
    );
  });

  it('should force delete branch', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.deleteBranch('old-feature', true);

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git branch -D old-feature'),
      expect.any(Object)
    );
  });

  // ==================== Commit Log ====================

  it('should get commit log', async () => {
    const logOutput = `1234567|John Doe|2024-01-15|Initial commit
8901234|Jane Smith|2024-01-14|Add feature`;

    mockExecAsyncFn.mockResolvedValueOnce({ stdout: logOutput, stderr: '' });

    const log = await gitManager.getLog(10);

    expect(log.length).toBe(2);
    expect(log[0].hash).toBe('1234567');
    expect(log[0].author).toBe('John Doe');
    expect(log[0].date).toBe('2024-01-15');
    expect(log[0].message).toBe('Initial commit');
  });

  // ==================== Fetch/Pull ====================

  it('should fetch from remote', async () => {
    mockExecAsyncFn.mockResolvedValueOnce({ stdout: '', stderr: '' });

    await gitManager.fetch('origin');

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git fetch origin'),
      expect.any(Object)
    );
  });

  it('should pull from remote', async () => {
    mockExecAsyncFn
      .mockResolvedValueOnce({ stdout: 'main', stderr: '' }) // rev-parse branch
      .mockResolvedValueOnce({ stdout: '', stderr: '' }); // pull

    await gitManager.pull('origin', 'main');

    expect(mockExecAsyncFn).toHaveBeenCalledWith(
      expect.stringContaining('git pull origin main'),
      expect.any(Object)
    );
  });

  // ==================== Error Handling ====================

  it('should throw error on git command failure', async () => {
    mockExecAsyncFn.mockRejectedValueOnce(new Error('git command failed'));

    await expect(gitManager.getStatus()).rejects.toThrow('Git command failed');
  });
});
