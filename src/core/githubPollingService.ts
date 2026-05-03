/**
 * GitHub Polling Service — Zero-Prompt proaktív monitoring
 *
 * Periodikusan lekérdezi a GitHub issue-kat és PR-eket,
 * és eventFabric eseményeket generál változásokra.
 * Konfigurálható: .github-polling.json fájllal.
 */
import { existsSync, readFileSync } from 'fs';
import { logInfo, logError } from '../utils/logger.js';
import { githubAPI } from './githubAPIClient.js';
import { eventFabric, createGithubIssueEventEnvelope, createGithubPREventEnvelope } from './eventFabric.js';

export interface GitHubMonitorConfig {
  owner: string;
  repo: string;
  pollIntervalMs: number;
  monitorIssues: boolean;
  monitorPRs: boolean;
  labelFilters?: string[]; // csak ezekre a labelekre figyeljen
}

interface TrackedItem {
  updatedAt: string;
  state: string;
}

export class GitHubPollingService {
  private configs: GitHubMonitorConfig[] = [];
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private lastSeen: Map<string, Map<string, TrackedItem>> = new Map();
  private running = false;

  loadConfig(configPath = '.github-polling.json'): void {
    if (!existsSync(configPath)) {
      logInfo('GitHubPollingService', `Nincs polling config (${configPath}) — polling letiltva`);
      return;
    }
    try {
      const raw = readFileSync(configPath, 'utf-8');
      this.configs = JSON.parse(raw) as GitHubMonitorConfig[];
      logInfo('GitHubPollingService', `${this.configs.length} repository monitoring betöltve`);
    } catch (e: unknown) {
      logError('GitHubPollingService', `Config betöltés sikertelen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  startPolling(): void {
    if (this.running) return;
    this.running = true;

    for (const cfg of this.configs) {
      const key = `${cfg.owner}/${cfg.repo}`;
      // Azonnal lefut egyszer, majd periodikusan
      void this.pollRepository(cfg);
      const timer = setInterval(() => void this.pollRepository(cfg), cfg.pollIntervalMs);
      this.timers.set(key, timer);
      logInfo('GitHubPollingService', `Polling indul: ${key} (${cfg.pollIntervalMs}ms)`);
    }
  }

  stopPolling(): void {
    for (const [key, timer] of this.timers.entries()) {
      clearInterval(timer);
      logInfo('GitHubPollingService', `Polling leáll: ${key}`);
    }
    this.timers.clear();
    this.running = false;
  }

  getStatus(): { running: boolean; repos: string[]; itemsTracked: number } {
    let total = 0;
    for (const m of this.lastSeen.values()) total += m.size;
    return {
      running: this.running,
      repos: [...this.timers.keys()],
      itemsTracked: total,
    };
  }

  private async pollRepository(cfg: GitHubMonitorConfig): Promise<void> {
    const repoKey = `${cfg.owner}/${cfg.repo}`;
    try {
      if (cfg.monitorIssues) await this.pollIssues(cfg, repoKey);
      if (cfg.monitorPRs) await this.pollPRs(cfg, repoKey);
    } catch (e: unknown) {
      logError('GitHubPollingService', `Poll hiba [${repoKey}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async pollIssues(cfg: GitHubMonitorConfig, repoKey: string): Promise<void> {
    const issues = await githubAPI.getIssues(cfg.owner, cfg.repo, 'open', 50);
    const storeKey = `${repoKey}:issues`;
    if (!this.lastSeen.has(storeKey)) this.lastSeen.set(storeKey, new Map());
    const seen = this.lastSeen.get(storeKey)!;

    for (const issue of issues) {
      if (cfg.labelFilters && cfg.labelFilters.length > 0) {
        const issueLabels = issue.labels.map(l => l.name);
        if (!cfg.labelFilters.some(f => issueLabels.includes(f))) continue;
      }

      const id = String(issue.number);
      const prev = seen.get(id);
      const isNew = !prev;
      const changed = prev && (prev.updatedAt !== issue.updated_at || prev.state !== issue.state);

      if (isNew || changed) {
        const eventType: 'opened' | 'updated' | 'closed' = isNew ? 'opened' : (issue.state === 'closed' ? 'closed' : 'updated');
        eventFabric.publish(createGithubIssueEventEnvelope({
          repositoryName: `${cfg.owner}/${cfg.repo}`,
          issueNumber: issue.number,
          title: issue.title,
          state: issue.state,
          labels: issue.labels.map(l => l.name),
          author: issue.user.login,
          updatedAt: issue.updated_at,
          createdAt: issue.created_at,
          isNew,
          eventType,
        }));
        logInfo('GitHubPollingService', `Issue esemény: ${cfg.owner}/${cfg.repo}#${id} [${eventType}]`);
      }

      seen.set(id, { updatedAt: issue.updated_at, state: issue.state });
    }
  }

  private async pollPRs(cfg: GitHubMonitorConfig, repoKey: string): Promise<void> {
    const prs = await githubAPI.getPullRequests(cfg.owner, cfg.repo, 'open', 50);
    const storeKey = `${repoKey}:prs`;
    if (!this.lastSeen.has(storeKey)) this.lastSeen.set(storeKey, new Map());
    const seen = this.lastSeen.get(storeKey)!;

    for (const pr of prs) {
      const id = String(pr.number);
      const prev = seen.get(id);
      const isNew = !prev;
      const changed = prev && (prev.updatedAt !== pr.updated_at || prev.state !== pr.state);

      if (isNew || changed) {
        const eventType: 'opened' | 'synchronized' | 'closed' = isNew ? 'opened' : (pr.state === 'closed' ? 'closed' : 'synchronized');
        eventFabric.publish(createGithubPREventEnvelope({
          repositoryName: `${cfg.owner}/${cfg.repo}`,
          prNumber: pr.number,
          title: pr.title,
          state: pr.state,
          branch: pr.head.ref,
          baseBranch: pr.base.ref,
          sha: pr.head.sha,
          author: pr.user.login,
          draft: pr.draft,
          updatedAt: pr.updated_at,
          createdAt: pr.created_at,
          isNew,
          eventType,
        }));
        logInfo('GitHubPollingService', `PR esemény: ${cfg.owner}/${cfg.repo}#${id} [${eventType}]`);
      }

      seen.set(id, { updatedAt: pr.updated_at, state: pr.state });
    }
  }
}

export const githubPollingService = new GitHubPollingService();
