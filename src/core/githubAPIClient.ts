/**
 * GitHub API Client
 * 
 * Handles authentication and API calls to GitHub for:
 * - Fetching workflow run details
 * - Getting workflow logs
 * - Creating issues and PRs
 * 
 * Environment Variables:
 * - GITHUB_TOKEN: Personal access token with repo + workflow scopes
 */

import { logInfo, logError } from '../utils/logger.js';

export interface WorkflowRunDetails {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
  repository: {
    name: string;
    owner: { login: string };
    html_url: string;
  };
}

export interface WorkflowLog {
  logs: string;
  size: number;
  expires_at: string;
}

export interface RepositoryFile {
  name: string;
  path: string;
  content: string; // base64 encoded
}

export class GitHubAPIClient {
  private baseUrl = 'https://api.github.com';
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      logError('GitHubAPIClient', 'GITHUB_TOKEN environment variable not set');
    }
  }

  /**
   * Make authenticated GitHub API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'brunella-jcai'
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${error}`);
      }

      const data = await response.json() as T;
      return data;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      logError('GitHubAPIClient', `Request failed (${method} ${path}): ${err}`);
      throw e;
    }
  }

  /**
   * Get workflow run details
   */
  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRunDetails> {
    logInfo('GitHubAPIClient', `Fetching workflow run ${runId}`);
    
    const data = await this.request<WorkflowRunDetails>(
      'GET',
      `/repos/${owner}/${repo}/actions/runs/${runId}`
    );

    return data;
  }

  /**
   * Get workflow run logs (download as zip)
   * Returns the full log output
   */
  async getWorkflowRunLogs(owner: string, repo: string, runId: number): Promise<string> {
    logInfo('GitHubAPIClient', `Fetching logs for workflow run ${runId}`);

    try {
      // GitHub API provides logs download URL in the response
      const url = `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs (${response.status})`);
      }

      // The response is the raw log file
      const logs = await response.text();
      return logs;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      logError('GitHubAPIClient', `Failed to get workflow logs: ${err}`);
      throw e;
    }
  }

  /**
   * Get last N jobs from workflow run
   */
  async getWorkflowRunJobs(
    owner: string,
    repo: string,
    runId: number,
    limit = 10
  ): Promise<Array<{ id: number; name: string; conclusion: string; logs_url?: string }>> {
    logInfo('GitHubAPIClient', `Fetching jobs for workflow run ${runId}`);

    const data = await this.request<{
      jobs: Array<{ id: number; name: string; conclusion: string; logs_url?: string }>;
    }>(
      'GET',
      `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=${limit}`
    );

    return data.jobs;
  }

  /**
   * Get repository file content
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    logInfo('GitHubAPIClient', `Fetching file: ${path}`);

    const data = await this.request<{ content: string }>(
      'GET',
      `/repos/${owner}/${repo}/contents/${path}`
    );

    // Decode base64
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    return decoded;
  }

  /**
   * Create an issue in the repository
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = []
  ): Promise<{ number: number; html_url: string }> {
    logInfo('GitHubAPIClient', `Creating issue: "${title}"`);

    const data = await this.request<{ number: number; html_url: string }>(
      'POST',
      `/repos/${owner}/${repo}/issues`,
      { title, body, labels }
    );

    return data;
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<{ number: number; html_url: string }> {
    logInfo('GitHubAPIClient', `Creating PR: "${title}" (${head} → ${base})`);

    const data = await this.request<{ number: number; html_url: string }>(
      'POST',
      `/repos/${owner}/${repo}/pulls`,
      { title, body, head, base }
    );

    return data;
  }

  /**
   * Get commits between two refs
   */
  async getCommitsDiff(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<{ commits: Array<{ sha: string; message: string; author: { name: string } }> }> {
    logInfo('GitHubAPIClient', `Comparing ${base}...${head}`);

    const data = await this.request<{
      commits: Array<{ sha: string; message: string; author: { name: string } }>;
    }>(
      'GET',
      `/repos/${owner}/${repo}/compare/${base}...${head}`
    );

    return data;
  }

  /**
   * Create a comment on a PR
   */
  async createPullRequestComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<{ id: number }> {
    logInfo('GitHubAPIClient', `Commenting on PR #${prNumber}`);

    const data = await this.request<{ id: number }>(
      'POST',
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body }
    );

    return data;
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    commitTitle?: string
  ): Promise<{ sha: string; merged: boolean }> {
    logInfo('GitHubAPIClient', `Merging PR #${prNumber}`);

    const data = await this.request<{ sha: string; merged: boolean }>(
      'PUT',
      `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        commit_title: commitTitle || undefined,
        merge_method: 'squash'
      }
    );

    return data;
  }

  /**
   * List branches
   */
  async listBranches(owner: string, repo: string): Promise<Array<{ name: string }>> {
    logInfo('GitHubAPIClient', `Listing branches`);

    const data = await this.request<Array<{ name: string }>>(
      'GET',
      `/repos/${owner}/${repo}/branches`
    );

    return data;
  }

  /**
   * List open (or other state) issues for a repository
   */
  async getIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit = 50
  ): Promise<Array<{
    number: number;
    title: string;
    state: string;
    body: string;
    created_at: string;
    updated_at: string;
    labels: Array<{ name: string }>;
    user: { login: string };
  }>> {
    logInfo('GitHubAPIClient', `Listing issues (${state}) for ${owner}/${repo}`);
    return this.request<Array<{
      number: number; title: string; state: string; body: string;
      created_at: string; updated_at: string;
      labels: Array<{ name: string }>; user: { login: string };
    }>>('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}&sort=updated&direction=desc`);
  }

  /**
   * Get a single issue
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<{
    number: number;
    title: string;
    state: string;
    body: string;
    created_at: string;
    updated_at: string;
    labels: Array<{ name: string }>;
    user: { login: string };
  }> {
    logInfo('GitHubAPIClient', `Fetching issue #${issueNumber} for ${owner}/${repo}`);
    return this.request<{
      number: number; title: string; state: string; body: string;
      created_at: string; updated_at: string;
      labels: Array<{ name: string }>; user: { login: string };
    }>('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  /**
   * List pull requests for a repository
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit = 50
  ): Promise<Array<{
    number: number;
    title: string;
    state: string;
    created_at: string;
    updated_at: string;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string };
    draft: boolean;
  }>> {
    logInfo('GitHubAPIClient', `Listing PRs (${state}) for ${owner}/${repo}`);
    return this.request<Array<{
      number: number; title: string; state: string;
      created_at: string; updated_at: string;
      head: { ref: string; sha: string }; base: { ref: string };
      user: { login: string }; draft: boolean;
    }>>('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}&sort=updated&direction=desc`);
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    sha: string
  ): Promise<{ name: string }> {
    logInfo('GitHubAPIClient', `Creating branch: ${branchName}`);

    const data = await this.request<{ name: string }>(
      'POST',
      `/repos/${owner}/${repo}/git/refs`,
      {
        ref: `refs/heads/${branchName}`,
        sha
      }
    );

    return data;
  }
}

// Export singleton instance
export const githubAPI = new GitHubAPIClient();
