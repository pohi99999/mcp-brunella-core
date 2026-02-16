
import { exec } from 'child_process';
import { promisify } from 'util';
import { logInfo, logError } from '../utils/logger.js';
import { config } from '../config/schema.js';

const execAsync = promisify(exec);

export interface GitOptions {
  cwd?: string;
}

export class GitAutomation {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Run a git command
   */
  async git(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${command}`, { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch (error: any) {
      const msg = `Git command failed: git ${command} -> ${error.message}`;
      logError('GitAutomation', msg);
      throw new Error(msg);
    }
  }

  /**
   * Create a new branch for a fix
   */
  async createFixBranch(issueId: string): Promise<string> {
    const branchName = `fix/auto-${issueId}-${Date.now()}`;
    await this.git(`checkout -b ${branchName}`);
    logInfo('GitAutomation', `Created branch: ${branchName}`);
    return branchName;
  }

  /**
   * Commit changes
   */
  async commitChanges(message: string): Promise<void> {
    await this.git('add .');
    await this.git(`commit -m "${message}"`);
    logInfo('GitAutomation', `Committed changes: ${message}`);
  }

  /**
   * Push branch to remote
   */
  async pushBranch(branchName: string): Promise<void> {
    await this.git(`push origin ${branchName}`);
    logInfo('GitAutomation', `Pushed branch: ${branchName}`);
  }

  /**
   * Create a Pull Request (using GitHub API)
   */
  async createPullRequest(title: string, body: string, head: string, base: string = 'main'): Promise<string> {
    if (!config.githubToken) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    // Get repo owner/name from remote origin
    const remoteUrl = await this.git('config --get remote.origin.url');
    // Extract owner/repo from URL (supports https and ssh)
    // HTTPS: https://github.com/owner/repo.git
    // SSH: git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    
    if (!match) throw new Error('Could not parse repo name from remote');
    
    const owner = match[1];
    const repo = match[2];

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Brunella-GitAgent'
      },
      body: JSON.stringify({
        title,
        body,
        head,
        base
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError('GitAutomation', `Failed to create PR: ${errorText}`);
      throw new Error(`PR creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    logInfo('GitAutomation', `Created PR: ${data.html_url}`);
    return data.html_url;
  }

  /**
   * Checkout main and pull latest
   */
  async resetToMain(): Promise<void> {
    await this.git('checkout main');
    await this.git('pull origin main');
  }
}
