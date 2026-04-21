import { execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { agentManager } from '@packages/agents/AgentManager.js';
import { approvalRouter } from './approvalRouter.js';
import { captureApprovedRemediationGoldenCandidate } from './goldenDatasetBridge.js';
import {
  clearRemediationRuns,
  loadRemediationRuns,
  saveRemediationRun,
} from './autonomyRuntimeStore.js';
import { eventFabric, type EventEnvelope } from './eventFabric.js';
import { ephemeralAgentManager } from './ephemeralAgentManager.js';
import { githubAPI } from './githubAPIClient.js';
import { phoenixEventBus, type PhoenixApprovalResolvedEvent, type PhoenixEventFabricSignalEvent } from './phoenixEventBus.js';
import { DeploymentAnalyzer, type DeploymentAnalysis } from '@packages/utils/deploymentAnalyzer.js';
import { execCommand } from '@packages/utils/exec.js';
import { logError, logInfo, logWarn } from '@packages/utils/logger.js';
import type {
  RemediationFinalApprovalState,
  RemediationFixerState,
  RemediationRunRecord,
  RemediationRunsSummary,
  RemediationRunStatus,
  RemediationVerificationStep,
} from './remediationRuntime.types.js';

type WorkflowFailurePayload = Record<string, unknown> & {
  repositoryName?: string;
  repositoryOwner?: string;
  repositoryRepo?: string;
  workflowRunId?: string;
  workflowName?: string;
  headBranch?: string;
  htmlUrl?: string;
};

interface VerificationCommandPlan {
  name: string;
  command: string;
  args: string[];
  timeoutMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeRepositoryName(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/\.git$/, '');
}

function truncate(text: string | undefined, limit = 1200): string | undefined {
  if (!text) {
    return undefined;
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function buildFailureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toWorkflowFailurePayload(payload: unknown): WorkflowFailurePayload {
  return isRecord(payload) ? payload as WorkflowFailurePayload : {};
}

function parseWorkflowRunId(payload: WorkflowFailurePayload): number | null {
  const raw = getString(payload.workflowRunId);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildVerificationPlan(analysis?: DeploymentAnalysis): VerificationCommandPlan[] {
  const category = analysis?.category ?? 'unknown';

  if (category === 'test') {
    return [
      { name: 'fast-test-suite', command: 'npm', args: ['run', 'test:fast'], timeoutMs: 6 * 60 * 1000 },
    ];
  }

  if (category === 'lint') {
    return [
      { name: 'lint', command: 'npm', args: ['run', 'lint'], timeoutMs: 3 * 60 * 1000 },
      { name: 'fast-test-suite', command: 'npm', args: ['run', 'test:fast'], timeoutMs: 6 * 60 * 1000 },
    ];
  }

  return [
    { name: 'build', command: 'npm', args: ['run', 'build'], timeoutMs: 4 * 60 * 1000 },
    { name: 'fast-test-suite', command: 'npm', args: ['run', 'test:fast'], timeoutMs: 6 * 60 * 1000 },
  ];
}

function chooseFixer(analysis?: DeploymentAnalysis): { agentName: string; task: string } {
  const category = analysis?.category ?? 'unknown';
  const affectedFiles = analysis?.affectedFiles ?? [];
  const focus = affectedFiles.length > 0 ? ` Focus files: ${affectedFiles.join(', ')}.` : '';
  const errorDetails = analysis?.errors?.slice(0, 3).join(' | ') ?? analysis?.message ?? 'Unknown workflow failure';

  if (category === 'lint') {
    const targetFile = affectedFiles.length === 1 ? ` ${affectedFiles[0]}` : '';
    return {
      agentName: 'lint_fixer',
      task: `fix${targetFile} lint issues from GitHub workflow failure.${focus} Error details: ${errorDetails}`,
    };
  }

  const prompt = [
    'Fix the local repository so the failed GitHub workflow can pass again.',
    `Category: ${category}.`,
    `Summary: ${analysis?.summary ?? 'Unknown failure'}.`,
    focus.trim(),
    'Work only in the current workspace.',
    'Do not create commits or branches.',
    'Prefer minimal surgical code changes.',
    `Raw clues: ${truncate(analysis?.rawError, 1000) ?? errorDetails}`,
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return {
    agentName: 'Developer',
    task: prompt,
  };
}

function summarizeDelegateResult(result: unknown): { failed: boolean; summary: string } {
  if (isRecord(result)) {
    const status = getString(result.status);
    const message = getString(result.message);
    const error = getString(result.error);
    const success = typeof result.success === 'boolean' ? result.success : undefined;
    const dataMessage = isRecord(result.data) ? getString(result.data.message) : undefined;
    const summary = [status, message, dataMessage, error].filter(Boolean).join(' | ') || truncate(JSON.stringify(result), 500) || 'No result';
    const failed = status === 'error' || success === false;
    return { failed, summary };
  }

  return {
    failed: false,
    summary: truncate(typeof result === 'string' ? result : JSON.stringify(result), 500) ?? 'Completed',
  };
}

class GitHubRemediationRuntime {
  private readonly runs = new Map<string, RemediationRunRecord>();
  private readonly sourceDedupToRunId = new Map<string, string>();
  private readonly activeSourceKeys = new Set<string>();
  private started = false;
  private hydrated = false;
  private workspaceRepositories?: Set<string>;

  private readonly onEventFabricSignal = (event: PhoenixEventFabricSignalEvent): void => {
    if (event.eventType !== 'github.workflow_run.failure') {
      return;
    }

    void this.ingestFailureEnvelope(event.envelope as EventEnvelope<Record<string, unknown>>);
  };

  private readonly onApprovalResolved = (event: PhoenixApprovalResolvedEvent): void => {
    this.syncRunFromApprovalEvent(event);
  };

  private ensureHydrated(): void {
    if (this.hydrated) {
      return;
    }

    const restored = loadRemediationRuns();
    for (const run of restored) {
      this.runs.set(run.id, run);
      this.sourceDedupToRunId.set(run.sourceDedupKey, run.id);
    }

    this.hydrated = true;
  }

  hydrateFromStore(): number {
    this.ensureHydrated();
    return this.runs.size;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.ensureHydrated();
    this.started = true;
    phoenixEventBus.subscribe('phoenix:event_fabric_signal', this.onEventFabricSignal);
    phoenixEventBus.subscribe('phoenix:approval_resolved', this.onApprovalResolved);
    this.resumeStoredRuns();
    this.reconcileHistoricalFailures();
    logInfo('GitHubRemediationRuntime', 'GitHub remediation runtime started');
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    phoenixEventBus.unsubscribe('phoenix:event_fabric_signal', this.onEventFabricSignal);
    phoenixEventBus.unsubscribe('phoenix:approval_resolved', this.onApprovalResolved);
    this.started = false;
  }

  isActive(): boolean {
    return this.started;
  }

  clear(): void {
    this.runs.clear();
    this.sourceDedupToRunId.clear();
    this.activeSourceKeys.clear();
    this.hydrated = true;
    clearRemediationRuns();
  }

  listRuns(status?: RemediationRunStatus, limit = 20): RemediationRunRecord[] {
    this.ensureHydrated();
    const all = Array.from(this.runs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = status ? all.filter((run) => run.status === status) : all;
    return filtered.slice(0, limit);
  }

  getRun(runId: string): RemediationRunRecord | undefined {
    this.ensureHydrated();
    return this.runs.get(runId);
  }

  getRunBySourceDedupKey(dedupKey: string): RemediationRunRecord | undefined {
    this.ensureHydrated();
    const runId = this.sourceDedupToRunId.get(dedupKey);
    return runId ? this.runs.get(runId) : undefined;
  }

  getSummary(): RemediationRunsSummary {
    this.ensureHydrated();
    const runs = Array.from(this.runs.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const counts = runs.reduce<Partial<Record<RemediationRunStatus, number>>>((acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1;
      return acc;
    }, {});
    const latestRun = runs[0];
    const inFlightStatuses = new Set<RemediationRunStatus>([
      'queued',
      'analyzing',
      'running_fixer',
      'verifying',
      'awaiting_final_approval',
    ]);

    return {
      total: runs.length,
      counts,
      active: this.started,
      latestUpdatedAt: latestRun?.updatedAt,
      pendingFinalApproval: runs.filter((run) => run.status === 'awaiting_final_approval').length,
      inFlight: runs.filter((run) => inFlightStatuses.has(run.status)).length,
      latestRunId: latestRun?.id,
      latestRunStatus: latestRun?.status,
      latestRepositoryName: latestRun?.repositoryName,
      latestFailureReason: latestRun?.failureReason,
    };
  }

  async ingestFailureEnvelope(envelope: EventEnvelope<Record<string, unknown>>): Promise<RemediationRunRecord | null> {
    this.ensureHydrated();
    const payload = toWorkflowFailurePayload(envelope.payload);
    const repositoryName = getString(payload.repositoryName);
    const repositoryOwner = getString(payload.repositoryOwner);
    const repositoryRepo = getString(payload.repositoryRepo);

    if (!this.isWorkspaceRepository(repositoryName, repositoryOwner, repositoryRepo)) {
      logWarn(
        'GitHubRemediationRuntime',
        `Skipping remediation for non-workspace repository: ${repositoryName ?? 'unknown'}`,
      );
      return null;
    }

    const existingRun = this.getRunBySourceDedupKey(envelope.dedupKey);
    if (existingRun) {
      if (this.shouldResumeRun(existingRun)) {
        void this.processRun(existingRun.id);
      }
      return existingRun;
    }

    const now = new Date().toISOString();
    const run: RemediationRunRecord = {
      id: uuidv4(),
      sourceEventId: envelope.id,
      sourceDedupKey: envelope.dedupKey,
      sourceEventType: envelope.type,
      repositoryName: repositoryName ?? 'unknown',
      repositoryOwner,
      repositoryRepo,
      workflowRunId: getString(payload.workflowRunId),
      workflowName: getString(payload.workflowName),
      branch: getString(payload.headBranch),
      htmlUrl: getString(payload.htmlUrl),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      verification: [],
    };

    this.persistRun(run);
    void this.processRun(run.id);
    return run;
  }

  private persistRun(run: RemediationRunRecord): void {
    run.updatedAt = new Date().toISOString();
    this.runs.set(run.id, run);
    this.sourceDedupToRunId.set(run.sourceDedupKey, run.id);
    saveRemediationRun(run);
    phoenixEventBus.publish('phoenix:remediation_run_updated', {
      runId: run.id,
      status: run.status,
      repositoryName: run.repositoryName,
      workflowRunId: run.workflowRunId,
      failureReason: run.failureReason,
      updatedAt: run.updatedAt,
      timestamp: run.updatedAt,
    });
  }

  private async processRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }

    if (!this.shouldResumeRun(run)) {
      return;
    }

    if (this.activeSourceKeys.has(run.sourceDedupKey)) {
      return;
    }

    this.activeSourceKeys.add(run.sourceDedupKey);
    let ephemeralAgentId: string | undefined;

    try {
      if (!run.analysis) {
        run.status = 'analyzing';
        this.persistRun(run);
        await this.analyzeRun(run);
      }

      run.status = 'running_fixer';
      const fixerSelection = chooseFixer(run.analysis);
      const fixer: RemediationFixerState = run.fixer ?? {
        agentName: fixerSelection.agentName,
        task: fixerSelection.task,
        status: 'pending',
      };

      if (!fixer.ephemeralAgentId) {
        const record = await ephemeralAgentManager.spawn({
          parentAgentName: 'GitHubRemediationRuntime',
          purpose: `GitHub workflow remediation for ${run.repositoryName}`,
          allowedTools: ['agent:Developer', 'agent:lint_fixer', 'command:npm run build', 'command:npm run test:fast'],
          allowedPaths: [process.cwd()],
          ttlMs: 15 * 60 * 1000,
          metadata: {
            remediationRunId: run.id,
            repositoryName: run.repositoryName,
            workflowRunId: run.workflowRunId,
          },
        });
        fixer.ephemeralAgentId = record.id;
      }

      ephemeralAgentId = fixer.ephemeralAgentId;
      fixer.agentName = fixerSelection.agentName;
      fixer.task = fixerSelection.task;
      fixer.status = 'running';
      fixer.startedAt = new Date().toISOString();
      fixer.finishedAt = undefined;
      fixer.resultSummary = undefined;
      fixer.executedBy = 'AgentManager';
      run.fixer = fixer;
      this.persistRun(run);

      const delegateResult = await agentManager.delegate(fixer.agentName, fixer.task, {
        remediationRunId: run.id,
        repositoryName: run.repositoryName,
        workflowRunId: run.workflowRunId,
        workflowName: run.workflowName,
        branch: run.branch,
        analysis: run.analysis,
      });

      const fixerSummary = summarizeDelegateResult(delegateResult);
      fixer.resultSummary = fixerSummary.summary;
      fixer.finishedAt = new Date().toISOString();
      fixer.status = fixerSummary.failed ? 'failed' : 'succeeded';
      run.fixer = fixer;
      this.persistRun(run);

      if (fixerSummary.failed) {
        throw new Error(fixerSummary.summary);
      }

      run.status = 'verifying';
      run.verification = buildVerificationPlan(run.analysis).map((plan) => ({
        name: plan.name,
        command: plan.command,
        args: plan.args,
        status: 'pending',
      }));
      this.persistRun(run);

      await this.verifyRun(run);

      if (ephemeralAgentId) {
        ephemeralAgentManager.terminate(ephemeralAgentId, 'verification_completed');
      }

      await this.requestFinalApproval(run);
    } catch (error) {
      if (ephemeralAgentId) {
        ephemeralAgentManager.terminate(ephemeralAgentId, 'remediation_failed');
      }
      this.failRun(run, buildFailureReason(error));
    } finally {
      this.activeSourceKeys.delete(run.sourceDedupKey);
    }
  }

  private async analyzeRun(run: RemediationRunRecord): Promise<void> {
    const runId = parseWorkflowRunId({
      workflowRunId: run.workflowRunId,
    });

    if (!run.repositoryOwner || !run.repositoryRepo || runId === null) {
      throw new Error('Missing repository owner/repo or workflow run id for remediation analysis');
    }

    const logs = await githubAPI.getWorkflowRunLogs(run.repositoryOwner, run.repositoryRepo, runId);
    run.logsExcerpt = truncate(logs, 4000);
    run.analysis = DeploymentAnalyzer.analyzeLogs(logs);
    this.persistRun(run);
  }

  private async verifyRun(run: RemediationRunRecord): Promise<void> {
    const plans = buildVerificationPlan(run.analysis);
    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      const step = run.verification[index];
      step.startedAt = new Date().toISOString();
      step.status = 'pending';
      this.persistRun(run);

      try {
        const result = await execCommand(plan.command, plan.args, {
          cwd: process.cwd(),
          timeout: plan.timeoutMs,
        });

        step.finishedAt = new Date().toISOString();
        step.exitCode = result.exitCode;
        step.stdout = truncate(result.stdout, 2000);
        step.stderr = truncate(result.stderr, 2000);
        step.status = result.exitCode === 0 ? 'passed' : 'failed';
        this.persistRun(run);

        if (result.exitCode !== 0) {
          throw new Error(`${plan.name} failed with exit code ${result.exitCode}`);
        }
      } catch (error) {
        step.finishedAt = new Date().toISOString();
        step.status = 'failed';
        step.stderr = truncate(buildFailureReason(error), 2000);
        this.persistRun(run);
        throw error;
      }
    }
  }

  private async requestFinalApproval(run: RemediationRunRecord): Promise<void> {
    const decision = {
      actionClass: 'guarded' as const,
      riskScore: 72,
      autonomyLevel: 'low' as const,
      requiresApproval: true,
      reason: 'Autonomous remediation completed successfully; final operator approval is required before closure.',
      guardrails: ['require_final_approval', 'preserve_verification_artifacts', 'log_failure_context'],
      auditResult: 'ALLOWED' as const,
    };

    const workflow = await approvalRouter.createWorkflowFromPolicy(decision, {
      event: {
        id: uuidv4(),
        source: 'remediation_runtime',
        type: 'github.workflow_run.remediation_ready',
        priority: 'high',
        riskHint: 'guarded',
        dedupKey: `remediation:final:${run.id}`,
        payload: {
          remediationRunId: run.id,
          repositoryName: run.repositoryName,
          workflowRunId: run.workflowRunId,
          workflowName: run.workflowName,
          branch: run.branch,
          analysis: run.analysis,
          verification: run.verification,
          htmlUrl: run.htmlUrl,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          remediationRunId: run.id,
          workflowRunId: run.workflowRunId,
          repositoryName: run.repositoryName,
        },
      },
      agentName: 'GitHubRemediationRuntime',
      resource: run.repositoryName,
    });

    if (!workflow) {
      throw new Error('Failed to create final approval workflow for remediation run');
    }

    const finalApproval: RemediationFinalApprovalState = {
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      status: workflow.status,
      requestedAt: workflow.createdAt,
      respondedAt: workflow.respondedAt,
      response: workflow.response,
    };

    run.status = 'awaiting_final_approval';
    run.finalApproval = finalApproval;
    this.persistRun(run);
  }

  private syncRunFromApprovalEvent(event: PhoenixApprovalResolvedEvent): void {
    this.ensureHydrated();
    const workflow = approvalRouter.getWorkflow(event.workflowId);
    if (!workflow) {
      return;
    }

    const remediationRunId =
      getString(isRecord(workflow.eventMetadata) ? workflow.eventMetadata.remediationRunId : undefined) ??
      getString(isRecord(workflow.eventPayload) ? workflow.eventPayload.remediationRunId : undefined);

    if (!remediationRunId) {
      return;
    }

    const run = this.runs.get(remediationRunId);
    if (!run) {
      return;
    }

    run.finalApproval = {
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      status: workflow.status,
      requestedAt: workflow.createdAt,
      respondedAt: workflow.respondedAt,
      response: workflow.response,
    };

    if (workflow.status === 'approved') {
      run.status = 'approved';
      run.failureReason = undefined;
    } else if (workflow.status === 'rejected') {
      run.status = 'rejected';
      run.failureReason = 'final_approval_rejected';
    } else if (workflow.status === 'expired') {
      run.status = 'failed';
      run.failureReason = 'final_approval_expired';
    }

    this.persistRun(run);

    if (workflow.status === 'approved') {
      const captureResult = captureApprovedRemediationGoldenCandidate(run);
      if (!captureResult.success) {
        logWarn(
          'GitHubRemediationRuntime',
          `Approved remediation sample capture skipped: ${captureResult.message ?? 'unknown reason'}`,
        );
      }
    }
  }

  private failRun(run: RemediationRunRecord, reason: string): void {
    run.status = 'failed';
    run.failureReason = reason;
    this.persistRun(run);
    logError('GitHubRemediationRuntime', `Run ${run.id} failed: ${reason}`);
  }

  private shouldResumeRun(run: RemediationRunRecord): boolean {
    return run.status === 'queued' || run.status === 'analyzing';
  }

  private resumeStoredRuns(): void {
    for (const run of this.runs.values()) {
      if (run.status === 'awaiting_final_approval' && run.finalApproval) {
        const workflow = approvalRouter.refreshWorkflow(run.finalApproval.workflowId);
        if (workflow && workflow.status !== 'pending') {
          this.syncRunFromApprovalEvent({
            workflowId: workflow.workflowId,
            approvalRequestId: workflow.approvalRequestId,
            status: workflow.status,
            action: workflow.status === 'approved' ? 'approve' : workflow.status === 'rejected' ? 'reject' : 'expire',
            response: workflow.response,
            resumeEventType: workflow.status === 'approved' ? 'approval.workflow.approved' : undefined,
            timestamp: workflow.respondedAt ?? workflow.updatedAt,
          });
        }
        continue;
      }

      if (run.status === 'running_fixer' || run.status === 'verifying') {
        if (run.fixer?.ephemeralAgentId) {
          ephemeralAgentManager.terminate(run.fixer.ephemeralAgentId, 'runtime_restart_interrupted');
        }
        this.failRun(run, 'runtime_restart_interrupted');
        continue;
      }

      if (this.shouldResumeRun(run)) {
        void this.processRun(run.id);
      }
    }
  }

  private reconcileHistoricalFailures(): void {
    const failures = eventFabric.getHistory({ type: 'github.workflow_run.failure', limit: 50 }).reverse();
    for (const envelope of failures) {
      if (!this.sourceDedupToRunId.has(envelope.dedupKey)) {
        void this.ingestFailureEnvelope(envelope as EventEnvelope<Record<string, unknown>>);
      }
    }
  }

  private isWorkspaceRepository(
    repositoryName: string | undefined,
    repositoryOwner: string | undefined,
    repositoryRepo: string | undefined,
  ): boolean {
    const expected = this.getWorkspaceRepositories();
    if (expected.size === 0) {
      return false;
    }

    const fullName = normalizeRepositoryName(repositoryName);
    if (fullName && expected.has(fullName)) {
      return true;
    }

    const ownerRepo = normalizeRepositoryName(
      repositoryOwner && repositoryRepo ? `${repositoryOwner}/${repositoryRepo}` : undefined,
    );
    return ownerRepo ? expected.has(ownerRepo) : false;
  }

  private getWorkspaceRepositories(): Set<string> {
    if (this.workspaceRepositories) {
      return this.workspaceRepositories;
    }

    const repositories = new Set<string>();
    const configured = normalizeRepositoryName(process.env.BRUNELLA_REPOSITORY_FULL_NAME);
    if (configured) {
      repositories.add(configured);
    }

    try {
      const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      }).trim();

      const match =
        remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/i) ??
        remote.match(/^([^/]+)\/(.+?)(?:\.git)?$/i);

      if (match) {
        repositories.add(`${match[1].toLowerCase()}/${match[2].toLowerCase()}`);
      }
    } catch {
      logWarn('GitHubRemediationRuntime', 'Workspace GitHub remote not available; remediation is repository-gated');
    }

    this.workspaceRepositories = repositories;
    return repositories;
  }
}

export const githubRemediationRuntime = new GitHubRemediationRuntime();

export default githubRemediationRuntime;

