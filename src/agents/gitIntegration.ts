/**
 * P8: Git Workflow Automatizáció
 * Git operations manager for Developer Agent 3.0
 * Provides: status, diff, commit, push, branch management
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const execAsync = promisify(exec);

// ==================== Types ====================

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';

export interface GitStatusResult {
    branch: string;
    remote?: string;
    ahead: number;
    behind: number;
    files: GitFileInfo[];
    staged: GitFileInfo[];
    unstaged: GitFileInfo[];
    untracked: string[];
    hasChanges: boolean;
}

export interface GitFileInfo {
    path: string;
    status: GitFileStatus;
    staged: boolean;
}

export interface GitDiffResult {
    file: string;
    diff: string;
    additions: number;
    deletions: number;
    hunks: DiffHunk[];
}

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
}

export interface GitCommitResult {
    hash: string;
    message: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
}

export interface GitPushResult {
    success: boolean;
    branch: string;
    remote: string;
    message: string;
}

export interface GitBranchInfo {
    name: string;
    current: boolean;
    remote?: string;
    lastCommit?: string;
}

export interface GitLogEntry {
    hash: string;
    author: string;
    date: string;
    message: string;
}

// ==================== Git Manager ====================

export class GitManager {
    private cwd: string;

    constructor(workspaceRoot: string) {
        this.cwd = workspaceRoot;
    }

    /**
     * Execute a git command and return output.
     */
    private async execGit(command: string): Promise<string> {
        try {
            const { stdout, stderr } = (await execAsync(`git ${command}`, {
                cwd: this.cwd,
                encoding: 'utf-8',
                timeout: 30000, // 30s timeout
            })) as { stdout: string; stderr: string };

            if (stderr && !stderr.includes('warning')) {
                logWarn('GitManager', `Git stderr: ${stderr.trim()}`);
            }

            // Use trimEnd() to preserve leading spaces (important for git status --porcelain)
            return stdout.trimEnd();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('GitManager', `Git command failed: git ${command} — ${msg}`);
            throw new Error(`Git command failed: ${msg}`);
        }
    }

    /**
     * Get current git status (branch, files, staged/unstaged changes).
     */
    async getStatus(): Promise<GitStatusResult> {
        logInfo('GitManager', 'Getting git status...');

        // Get branch and remote info
        const branch = await this.execGit('rev-parse --abbrev-ref HEAD');
        const remoteBranch = await this.execGit(`rev-parse --abbrev-ref ${branch}@{upstream}`).catch(() => '');
        
        // Get ahead/behind count
        let ahead = 0;
        let behind = 0;
        if (remoteBranch) {
            const counts = await this.execGit(`rev-list --left-right --count ${branch}...${remoteBranch}`).catch(() => '0\t0');
            const [aheadStr, behindStr] = counts.split('\t');
            ahead = parseInt(aheadStr, 10) || 0;
            behind = parseInt(behindStr, 10) || 0;
        }

        // Get file status (porcelain format)
        const statusOutput = await this.execGit('status --porcelain');
        const lines = statusOutput.split('\n').filter(l => l.trim());

        const files: GitFileInfo[] = [];
        const staged: GitFileInfo[] = [];
        const unstaged: GitFileInfo[] = [];
        const untracked: string[] = [];

        for (const line of lines) {
            const statusCode = line.substring(0, 2);
            const filePath = line.substring(3).trim();

            // Parse status codes (XY format: X=staged, Y=unstaged)
            const stagedCode = statusCode[0];
            const unstagedCode = statusCode[1];

            let status: GitFileStatus = 'modified';
            if (stagedCode === 'A' || unstagedCode === 'A') status = 'added';
            else if (stagedCode === 'D' || unstagedCode === 'D') status = 'deleted';
            else if (stagedCode === 'R' || unstagedCode === 'R') status = 'renamed';
            else if (stagedCode === 'U' || unstagedCode === 'U') status = 'conflicted';
            else if (stagedCode === '?' && unstagedCode === '?') status = 'untracked';

            const fileInfo: GitFileInfo = { path: filePath, status, staged: stagedCode !== ' ' && stagedCode !== '?' };

            files.push(fileInfo);

            if (stagedCode === '?' && unstagedCode === '?') {
                untracked.push(filePath);
            } else if (stagedCode !== ' ') {
                staged.push(fileInfo);
            }

            if (unstagedCode !== ' ' && unstagedCode !== '?') {
                unstaged.push({ ...fileInfo, staged: false });
            }
        }

        const result: GitStatusResult = {
            branch,
            remote: remoteBranch || undefined,
            ahead,
            behind,
            files,
            staged,
            unstaged,
            untracked,
            hasChanges: files.length > 0,
        };

        logInfo('GitManager', `Status: ${branch}, ${files.length} files changed, ${staged.length} staged`);
        return result;
    }

    /**
     * Get diff for a specific file or all staged changes.
     */
    async getDiff(filePath?: string, staged = false): Promise<GitDiffResult[]> {
        logInfo('GitManager', `Getting diff${filePath ? ` for ${filePath}` : ''}${staged ? ' (staged)' : ''}...`);

        const command = staged
            ? `diff --cached${filePath ? ` -- "${filePath}"` : ''}`
            : `diff${filePath ? ` -- "${filePath}"` : ''}`;

        const diffOutput = await this.execGit(command);
        if (!diffOutput) {
            return [];
        }

        return this.parseDiff(diffOutput);
    }

    /**
     * Parse unified diff output.
     */
    private parseDiff(diffOutput: string): GitDiffResult[] {
        const results: GitDiffResult[] = [];
        const fileDiffs = diffOutput.split(/^diff --git /gm).filter(Boolean);

        for (const fileDiff of fileDiffs) {
            const lines = fileDiff.split('\n');
            const firstLine = lines[0]; // a/path b/path
            const match = firstLine.match(/a\/(.+?) b\/(.+)/);
            if (!match) continue;

            const file = match[2]; // Use "b/" path (new file)
            let additions = 0;
            let deletions = 0;
            const hunks: DiffHunk[] = [];

            let currentHunk: DiffHunk | null = null;
            for (const line of lines) {
                if (line.startsWith('@@')) {
                    // Hunk header: @@ -old_start,old_lines +new_start,new_lines @@
                    const hunkMatch = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
                    if (hunkMatch) {
                        if (currentHunk) hunks.push(currentHunk);
                        currentHunk = {
                            oldStart: parseInt(hunkMatch[1], 10),
                            oldLines: parseInt(hunkMatch[2] || '1', 10),
                            newStart: parseInt(hunkMatch[3], 10),
                            newLines: parseInt(hunkMatch[4] || '1', 10),
                            lines: [],
                        };
                    }
                } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                    currentHunk.lines.push(line);
                    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
                    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
                }
            }

            if (currentHunk) hunks.push(currentHunk);

            results.push({
                file,
                diff: fileDiff,
                additions,
                deletions,
                hunks,
            });
        }

        logInfo('GitManager', `Parsed ${results.length} file diffs`);
        return results;
    }

    /**
     * Stage files (git add).
     */
    async stageFiles(files: string[]): Promise<void> {
        if (files.length === 0) {
            throw new Error('No files to stage');
        }

        logInfo('GitManager', `Staging ${files.length} files...`);
        const fileArgs = files.map(f => `"${f}"`).join(' ');
        await this.execGit(`add ${fileArgs}`);
        logInfo('GitManager', `Staged ${files.length} files`);
    }

    /**
     * Unstage files (git reset).
     */
    async unstageFiles(files: string[]): Promise<void> {
        if (files.length === 0) {
            throw new Error('No files to unstage');
        }

        logInfo('GitManager', `Unstaging ${files.length} files...`);
        const fileArgs = files.map(f => `"${f}"`).join(' ');
        await this.execGit(`reset HEAD ${fileArgs}`);
        logInfo('GitManager', `Unstaged ${files.length} files`);
    }

    /**
     * Commit staged changes.
     */
    async commit(message: string): Promise<GitCommitResult> {
        if (!message.trim()) {
            throw new Error('Commit message cannot be empty');
        }

        logInfo('GitManager', `Committing with message: "${message.substring(0, 50)}..."`);

        // Escape message for shell
        const escapedMsg = message.replace(/"/g, '\\"');
        const output = await this.execGit(`commit -m "${escapedMsg}"`);

        // Parse output: [branch hash] message
        // X files changed, Y insertions(+), Z deletions(-)
        const hashMatch = output.match(/\[.+?\s+([a-f0-9]{7,})\]/);
        const hash = hashMatch ? hashMatch[1] : '';

        const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        const filesChanged = statsMatch ? parseInt(statsMatch[1], 10) : 0;
        const insertions = statsMatch?.[2] ? parseInt(statsMatch[2], 10) : 0;
        const deletions = statsMatch?.[3] ? parseInt(statsMatch[3], 10) : 0;

        const result: GitCommitResult = {
            hash,
            message,
            filesChanged,
            insertions,
            deletions,
        };

        logInfo('GitManager', `Committed: ${hash} — ${filesChanged} files, +${insertions}/-${deletions}`);
        return result;
    }

    /**
     * Push current branch to remote.
     */
    async push(remote = 'origin', branch?: string): Promise<GitPushResult> {
        const currentBranch = branch || (await this.execGit('rev-parse --abbrev-ref HEAD'));
        logInfo('GitManager', `Pushing ${currentBranch} to ${remote}...`);

        try {
            const output = await this.execGit(`push ${remote} ${currentBranch}`);
            logInfo('GitManager', `Push successful: ${currentBranch} → ${remote}`);

            return {
                success: true,
                branch: currentBranch,
                remote,
                message: output || 'Push completed',
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('GitManager', `Push failed: ${msg}`);
            return {
                success: false,
                branch: currentBranch,
                remote,
                message: msg,
            };
        }
    }

    /**
     * List all branches (local and remote).
     */
    async listBranches(includeRemote = false): Promise<GitBranchInfo[]> {
        logInfo('GitManager', `Listing branches${includeRemote ? ' (including remote)' : ''}...`);

        const command = includeRemote ? 'branch -a -vv' : 'branch -vv';
        const output = await this.execGit(command);
        const lines = output.split('\n').filter(l => l.trim());

        const branches: GitBranchInfo[] = [];

        for (const line of lines) {
            const isCurrent = line.startsWith('*');
            const cleaned = line.replace(/^\*?\s+/, '');
            const parts = cleaned.split(/\s+/);

            if (parts.length < 2) continue;

            let name = parts[0];
            const lastCommit = parts[1];

            // Skip remote HEAD pointers
            if (name.includes('HEAD ->')) continue;

            // Parse remote tracking info [remote/branch]
            let remote: string | undefined;
            const remoteMatch = cleaned.match(/\[(.+?)\]/);
            if (remoteMatch) {
                remote = remoteMatch[1];
            }

            // If this is a remote branch (remotes/origin/...)
            if (name.startsWith('remotes/')) {
                name = name.replace('remotes/', '');
            }

            branches.push({
                name,
                current: isCurrent,
                remote,
                lastCommit,
            });
        }

        logInfo('GitManager', `Found ${branches.length} branches`);
        return branches;
    }

    /**
     * Create a new branch.
     */
    async createBranch(branchName: string, checkout = false): Promise<void> {
        logInfo('GitManager', `Creating branch: ${branchName}${checkout ? ' (checkout)' : ''}...`);

        const command = checkout ? `checkout -b ${branchName}` : `branch ${branchName}`;
        await this.execGit(command);

        logInfo('GitManager', `Branch created: ${branchName}`);
    }

    /**
     * Checkout an existing branch.
     */
    async checkoutBranch(branchName: string): Promise<void> {
        logInfo('GitManager', `Checking out branch: ${branchName}...`);
        await this.execGit(`checkout ${branchName}`);
        logInfo('GitManager', `Checked out: ${branchName}`);
    }

    /**
     * Delete a branch (local only).
     */
    async deleteBranch(branchName: string, force = false): Promise<void> {
        logInfo('GitManager', `Deleting branch: ${branchName}${force ? ' (force)' : ''}...`);
        const flag = force ? '-D' : '-d';
        await this.execGit(`branch ${flag} ${branchName}`);
        logInfo('GitManager', `Branch deleted: ${branchName}`);
    }

    /**
     * Get recent commit log.
     */
    async getLog(limit = 10): Promise<GitLogEntry[]> {
        logInfo('GitManager', `Getting last ${limit} commits...`);

        const format = '%H|%an|%ad|%s'; // hash|author|date|subject
        const output = await this.execGit(`log -${limit} --pretty=format:"${format}" --date=short`);
        const lines = output.split('\n').filter(l => l.trim());

        const entries: GitLogEntry[] = [];

        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 4) continue;

            entries.push({
                hash: parts[0].substring(0, 8), // Short hash
                author: parts[1],
                date: parts[2],
                message: parts[3],
            });
        }

        logInfo('GitManager', `Retrieved ${entries.length} commits`);
        return entries;
    }

    /**
     * Fetch from remote (update remote tracking branches).
     */
    async fetch(remote = 'origin'): Promise<void> {
        logInfo('GitManager', `Fetching from ${remote}...`);
        await this.execGit(`fetch ${remote}`);
        logInfo('GitManager', `Fetch completed: ${remote}`);
    }

    /**
     * Pull from remote (fetch + merge).
     */
    async pull(remote = 'origin', branch?: string): Promise<void> {
        const currentBranch = branch || (await this.execGit('rev-parse --abbrev-ref HEAD'));
        logInfo('GitManager', `Pulling ${currentBranch} from ${remote}...`);
        await this.execGit(`pull ${remote} ${currentBranch}`);
        logInfo('GitManager', `Pull completed: ${currentBranch} ← ${remote}`);
    }
}

// ==================== Singleton ====================

let gitManager: GitManager | null = null;

export function getGitManager(workspaceRoot?: string): GitManager {
    if (!gitManager) {
        if (!workspaceRoot) {
            throw new Error('GitManager not initialized. Provide workspaceRoot on first call.');
        }
        gitManager = new GitManager(workspaceRoot);
    }
    return gitManager;
}
