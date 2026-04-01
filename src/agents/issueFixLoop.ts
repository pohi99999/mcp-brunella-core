import path from 'path';
import { contextBuilder, type ContextOptions, type ContextResult } from './contextBuilder.js';
import { agentManager } from './AgentManager.js';
import { pipelineRunner } from './developerPipeline.js';
import { GitHubAPIClient } from '../core/githubAPIClient.js';
import {
  executeSafeCommand,
  recommendSafeVerificationCommands,
  validateSafeCommand,
  type SafeCommandExecutionResult,
  type SafeCommandValidation,
} from '../core/safeCommandPolicy.js';
import { loadDeveloperMcpProfile, type DeveloperMcpProfile } from '../config/developerProfile.js';
import { approvalManager } from '../utils/approvalManager.js';
import { activityFeed } from '../utils/activityFeed.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import {
  loadIssueFixAttemptRuntimeEntries,
  saveIssueFixAttemptRuntime,
  type PersistedIssueFixAttemptEntry,
} from '../core/autonomyRuntimeStore.js';

export interface IssueAnalysisRequest {
  issueNumber: number;
  owner?: string;
  repo?: string;
  filePathHints?: string[];
  contextOptions?: ContextOptions;
}

export interface IssueFixAttemptRequest extends IssueAnalysisRequest {
  approvalTimeoutMs?: number;
}

export interface IssueFixLoopSummary {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueState: string;
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;
  requestedAt: string;
  labels: string[];
  author: string;
}

export interface IssueContextCandidate {
  filePath: string;
  exists: boolean;
}

export interface IssueContextAnalysis {
  targetFile?: string;
  targetExists: boolean;
  candidates: IssueContextCandidate[];
  gathered: ContextResult;
}

export interface IssueFixRecommendation {
  summary: string;
  nextActions: string[];
  verificationCommands: string[];
  validatedCommands: SafeCommandValidation[];
}

export interface IssueAnalysisResult {
  mode: 'analysis-only';
  profile: DeveloperMcpProfile;
  issue: IssueFixLoopSummary;
  context: IssueContextAnalysis;
  recommendation: IssueFixRecommendation;
}

export type IssueFixAttemptStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'running'
  | 'done'
  | 'error';

export interface IssueFixAttemptRecord {
  taskId: string;
  approvalRequestId: string;
  status: IssueFixAttemptStatus;
  createdAt: string;
  updatedAt: string;
  issueNumber: number;
  issueTitle: string;
  repositoryFullName: string;
  targetFile?: string;
  analysisSummary: string;
  verificationCommands: string[];
  verificationResults?: SafeCommandExecutionResult[];
  lastError?: string;
}

export interface IssueFixAttemptStartResult {
  taskId: string;
  approvalRequestId: string;
  status: IssueFixAttemptStatus;
  analysis: IssueAnalysisResult;
}

interface ParsedIssueFileHints {
  explicit: string[];
  inferred: string[];
}

const issueFixAttempts = new Map<string, IssueFixAttemptRecord>();
const issueFixAttemptAnalyses = new Map<string, IssueAnalysisResult>();
let hydratedAttempts = false;
const rearmedTaskIds = new Set<string>();

function quotePathArgument(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function coerceIssueNumber(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('issueNumber must be a positive integer');
  }

  return value;
}

function normalizeWorkspaceRelative(filePath: string): string {
  return path.normalize(filePath.replace(/^\.?[\\/]/, ''));
}

function isWorkspaceRelativeFile(filePath: string): boolean {
  if (!filePath || path.isAbsolute(filePath)) {
    return false;
  }

  const normalized = normalizeWorkspaceRelative(filePath);
  if (normalized.startsWith(`..${path.sep}`) || normalized === '..') {
    return false;
  }

  return /\.(ts|tsx|js|jsx|json|sql|py|css)$/i.test(normalized);
}

function truncate(text: string, limit = 240): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function parseFileHintsFromIssue(body: string | undefined): ParsedIssueFileHints {
  if (!body) {
    return { explicit: [], inferred: [] };
  }

  const explicitMatches = Array.from(
    body.matchAll(/(?:`|")(src[\\/][^`"\n\r]+|test[\\/][^`"\n\r]+|myai[\\/][^`"\n\r]+)(?:`|")/g),
  )
    .map((match) => match[1])
    .filter((entry): entry is string => typeof entry === 'string')
    .filter(isWorkspaceRelativeFile)
    .map(normalizeWorkspaceRelative);

  const inferredMatches = Array.from(
    body.matchAll(/\b((?:src|test|myai)[\\/][A-Za-z0-9._\-/\\]+?\.(?:ts|tsx|js|jsx|json|sql|py|css))\b/g),
  )
    .map((match) => match[1])
    .filter((entry): entry is string => typeof entry === 'string')
    .filter(isWorkspaceRelativeFile)
    .map(normalizeWorkspaceRelative);

  return {
    explicit: dedupeStrings(explicitMatches),
    inferred: dedupeStrings(inferredMatches),
  };
}

async function pickContextTarget(
  profile: DeveloperMcpProfile,
  fileHints: string[],
  contextOptions?: ContextOptions,
): Promise<IssueContextAnalysis> {
  const normalizedHints = dedupeStrings(fileHints.map(normalizeWorkspaceRelative));
  const candidates: IssueContextCandidate[] = [];
  let targetFile: string | undefined;
  let targetExists = false;

  for (const hint of normalizedHints) {
    const absolute = path.resolve(profile.workspaceRoot, hint);
    const exists = await import('fs/promises')
      .then((fs) => fs.access(absolute).then(() => true).catch(() => false));

    candidates.push({ filePath: hint, exists });
    if (!targetFile && exists) {
      targetFile = hint;
      targetExists = true;
    }
  }

  if (!targetFile) {
    targetFile = normalizedHints[0] ?? 'src/index.ts';
    targetExists = candidates.find((entry) => entry.filePath === targetFile)?.exists ?? false;
  }

  const extraFiles = normalizedHints.filter((entry) => entry !== targetFile);
  const gathered = await contextBuilder.gatherContext(targetFile, {
    maxFiles: contextOptions?.maxFiles ?? 12,
    maxTotalSize: contextOptions?.maxTotalSize ?? 40_000,
    includeSiblings: contextOptions?.includeSiblings ?? true,
    includeTestPair: contextOptions?.includeTestPair ?? true,
    extraFiles,
    projectRoot: profile.workspaceRoot,
  });

  return {
    targetFile,
    targetExists,
    candidates,
    gathered,
  };
}

function buildRecommendation(context: IssueContextAnalysis): IssueFixRecommendation {
  const verificationCommands = recommendSafeVerificationCommands(
    [
      context.targetFile,
      ...context.gathered.files.map((file) => file.relativePath),
    ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
  );

  const validatedCommands = verificationCommands
    .map((command) => validateSafeCommand(command))
    .filter((decision) => decision.valid);

  const nextActions = [
    'Olvasd el a kiválasztott célfájlt és a kapcsolódó kontextusfájlokat.',
    'Készíts kis blast-radiusú módosítást a probléma legvalószínűbb gyökérokára.',
    'Futtasd a javasolt ellenőrző parancsokat a safe policy szerint.',
  ];

  if (!context.targetExists) {
    nextActions.unshift('A legjobb jelölt fájl jelenleg nem létezik; előbb pontosítsd a helyes célfájlt vagy hozd létre tudatosan.');
  }

  return {
    summary: context.targetExists
      ? `A legvalószínűbb belépési pont: ${context.targetFile}. A loop jelenleg csak elemzést és biztonságos verifikációs javaslatokat ad.`
      : 'Nem találtam biztosan létező célfájlt; a loop ezért analysis-only módban megáll a kontextus és a biztonságos verifikációs terv átadásánál.',
    nextActions,
    verificationCommands,
    validatedCommands,
  };
}

function buildFixAttemptTask(analysis: IssueAnalysisResult): string {
  const targetFile = analysis.context.targetFile ?? 'unknown';
  const labels = analysis.issue.labels.length > 0 ? analysis.issue.labels.join(', ') : 'n/a';

  return [
    `GitHub issue controlled fix attempt for ${analysis.issue.repositoryFullName}#${analysis.issue.issueNumber}.`,
    `Issue title: ${analysis.issue.issueTitle}`,
    `Labels: ${labels}`,
    `Likely target file: ${targetFile}`,
    '',
    'Issue body:',
    analysis.issue.issueBody || '(no body provided)',
    '',
    'Constraints:',
    '- Keep the blast radius small and modify only the files needed for the fix.',
    '- Respect existing project conventions and type safety.',
    '- Do not run shell verification yourself unless explicitly necessary; the orchestrator handles safe verification after generation.',
    '- Return a concise human summary when the code changes are done.',
  ].join('\n');
}

function buildFixAttemptContext(analysis: IssueAnalysisResult): Record<string, unknown> {
  return {
    filePath: analysis.context.targetFile,
    contextFiles: analysis.context.gathered.files.map((file) => file.relativePath),
    issueNumber: analysis.issue.issueNumber,
    issueTitle: analysis.issue.issueTitle,
    issueBody: analysis.issue.issueBody,
    repositoryFullName: analysis.issue.repositoryFullName,
    labels: analysis.issue.labels,
    orchestratorManagedVerification: true,
  };
}

function getFailureMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'error' in error && typeof (error as { error?: unknown }).error === 'string') {
    return (error as { error: string }).error;
  }
  return 'Unknown error';
}

function persistAttempt(taskId: string): void {
  const record = issueFixAttempts.get(taskId);
  if (!record) {
    return;
  }

  const entry: PersistedIssueFixAttemptEntry = {
    record,
    analysis: issueFixAttemptAnalyses.get(taskId),
  };
  saveIssueFixAttemptRuntime(entry);
}

function hydrateIssueFixAttempts(): void {
  if (hydratedAttempts) {
    return;
  }

  const restored = loadIssueFixAttemptRuntimeEntries();
  for (const entry of restored) {
    issueFixAttempts.set(entry.record.taskId, entry.record);
    if (entry.analysis) {
      issueFixAttemptAnalyses.set(entry.record.taskId, entry.analysis);
    }
  }

  hydratedAttempts = true;
  if (restored.length > 0) {
    logInfo(
      'IssueFixLoop',
      `Hydrated ${restored.length} persisted issue fix attempt(s)`,
    );
  }
}

function rearmPendingAttempt(
  taskId: string,
  analysis: IssueAnalysisResult,
  approvalRequestId: string,
): void {
  if (rearmedTaskIds.has(taskId)) {
    return;
  }

  rearmedTaskIds.add(taskId);
  void continueFixAttempt(taskId, approvalRequestId, analysis).catch(
    (error: unknown) => {
      const message = getFailureMessage(error);
      logWarn('IssueFixLoop', `Re-armed fix attempt failed: ${message}`);
      updateAttempt(taskId, {
        status: 'error',
        lastError: message,
      });
      pipelineRunner.failPhase(taskId, 'generate', message);
    },
  );
}

function ensureHydratedAttempts(): void {
  hydrateIssueFixAttempts();

  for (const [taskId, record] of issueFixAttempts.entries()) {
    const analysis = issueFixAttemptAnalyses.get(taskId);
    if (!analysis) {
      continue;
    }

    if (
      record.status === 'awaiting_approval' ||
      record.status === 'approved' ||
      record.status === 'running'
    ) {
      rearmPendingAttempt(taskId, analysis, record.approvalRequestId);
    }
  }
}

export function hydrateIssueFixAttemptsFromStore(): number {
  ensureHydratedAttempts();
  return issueFixAttempts.size;
}

function updateAttempt(taskId: string, patch: Partial<IssueFixAttemptRecord>): IssueFixAttemptRecord | undefined {
  ensureHydratedAttempts();
  const current = issueFixAttempts.get(taskId);
  if (!current) {
    return undefined;
  }

  const next: IssueFixAttemptRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  issueFixAttempts.set(taskId, next);
  persistAttempt(taskId);
  return next;
}

async function runVerificationCommands(commands: string[], workspaceRoot: string): Promise<SafeCommandExecutionResult[]> {
  const results: SafeCommandExecutionResult[] = [];
  for (const command of commands) {
    const result = executeSafeCommand(command, workspaceRoot);
    results.push(result);
    if (!result.success) {
      break;
    }
  }

  return results;
}

function buildTrackedInspectionCommands(analysis: IssueAnalysisResult): { statusCommand: string; diffCommand: string; trackedPaths: string[] } {
  const trackedPaths = dedupeStrings([
    analysis.context.targetFile,
    ...analysis.context.gathered.files.map((file) => file.relativePath),
  ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0).map(normalizeWorkspaceRelative));

  if (trackedPaths.length === 0) {
    return {
      statusCommand: 'git status --short',
      diffCommand: 'git diff --stat',
      trackedPaths: [],
    };
  }

  const quotedPaths = trackedPaths.map(quotePathArgument).join(' ');
  return {
    statusCommand: `git status --short ${quotedPaths}`,
    diffCommand: `git diff --stat -- ${quotedPaths}`,
    trackedPaths,
  };
}

async function continueFixAttempt(
  taskId: string,
  approvalRequestId: string,
  analysis: IssueAnalysisResult,
): Promise<void> {
  ensureHydratedAttempts();
  const taskRecord = issueFixAttempts.get(taskId);
  if (!taskRecord) {
    return;
  }

  const approved = await approvalManager.waitForResult(approvalRequestId);
  const request = approvalManager.getRequest(approvalRequestId);

  if (!approved) {
    const finalStatus: IssueFixAttemptStatus = request?.status === 'expired' ? 'expired' : 'rejected';
    const message = finalStatus === 'expired'
      ? 'Fix attempt approval expired before execution.'
      : 'Fix attempt approval was rejected.';
    updateAttempt(taskId, { status: finalStatus, lastError: message });
    pipelineRunner.failPhase(taskId, 'generate', message);
    return;
  }

  updateAttempt(taskId, { status: 'approved' });
  pipelineRunner.startPhase(taskId, 'generate');

  try {
    updateAttempt(taskId, { status: 'running' });
    const developerResult = await agentManager.delegate(
      'Developer',
      buildFixAttemptTask(analysis),
      buildFixAttemptContext(analysis),
    ) as { status?: string; error?: string; message?: string };

    if (developerResult?.status === 'error') {
      const message = developerResult.error ?? 'DeveloperAgent returned an error';
      updateAttempt(taskId, { status: 'error', lastError: message });
      pipelineRunner.failPhase(taskId, 'generate', message);
      return;
    }

    pipelineRunner.completePhase(taskId, 'generate', developerResult);

    pipelineRunner.startPhase(taskId, 'validate');
    pipelineRunner.completePhase(taskId, 'validate', {
      commandPlan: analysis.recommendation.validatedCommands.map((command) => ({
        command: command.normalizedCommand,
        policyId: command.policyId,
        category: command.category,
      })),
    });

    pipelineRunner.startPhase(taskId, 'save');
    const trackedInspection = buildTrackedInspectionCommands(analysis);
    const changeStatus = executeSafeCommand(trackedInspection.statusCommand, analysis.profile.workspaceRoot);
    if (!changeStatus.success) {
      const message = `Unable to inspect workspace changes: ${changeStatus.combinedOutput}`;
      updateAttempt(taskId, { status: 'error', lastError: message });
      pipelineRunner.failPhase(taskId, 'save', message);
      return;
    }
    if (!changeStatus.combinedOutput.trim()) {
      const message = 'DeveloperAgent finished without producing any workspace changes.';
      updateAttempt(taskId, { status: 'error', lastError: message });
      pipelineRunner.failPhase(taskId, 'save', message);
      return;
    }

    const diffStat = executeSafeCommand(trackedInspection.diffCommand, analysis.profile.workspaceRoot);
    pipelineRunner.completePhase(taskId, 'save', {
      trackedPaths: trackedInspection.trackedPaths,
      gitStatus: changeStatus.combinedOutput,
      diffStat: diffStat.combinedOutput,
    });

    pipelineRunner.startPhase(taskId, 'test');
    const verificationResults = await runVerificationCommands(
      analysis.recommendation.verificationCommands,
      analysis.profile.workspaceRoot,
    );
    const failedVerification = verificationResults.find((result) => !result.success);

    if (failedVerification) {
      const message = `Verification failed: ${failedVerification.normalizedCommand} → ${truncate(failedVerification.combinedOutput)}`;
      updateAttempt(taskId, {
        status: 'error',
        lastError: message,
        verificationResults,
      });
      pipelineRunner.failPhase(taskId, 'test', message);
      return;
    }

    pipelineRunner.completePhase(taskId, 'test', verificationResults.map((result) => ({
      command: result.normalizedCommand,
      success: result.success,
      output: truncate(result.combinedOutput, 400),
    })));
    pipelineRunner.completePipeline(taskId, {
      status: 'done',
      verificationCommands: analysis.recommendation.verificationCommands,
      verificationResults,
    });

    updateAttempt(taskId, {
      status: 'done',
      verificationResults,
      lastError: undefined,
    });
  } catch (error: unknown) {
    const message = getFailureMessage(error);
    logError('IssueFixLoop', `Fix attempt ${taskId} failed: ${message}`);
    updateAttempt(taskId, {
      status: 'error',
      lastError: message,
    });
    pipelineRunner.failPhase(taskId, 'generate', message);
  }
}

export async function analyzeIssueForFixLoop(
  request: IssueAnalysisRequest,
  profile = loadDeveloperMcpProfile(),
): Promise<IssueAnalysisResult> {
  const issueNumber = coerceIssueNumber(request.issueNumber);
  const owner = request.owner ?? profile.repositoryOwner;
  const repo = request.repo ?? profile.repositoryName;

  if (!owner || !repo) {
    throw new Error('Repository owner/repo is required for issue analysis');
  }

  if (!process.env.GITHUB_PAT && !process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_PAT or GITHUB_TOKEN is required for issue analysis');
  }

  const githubClient = new GitHubAPIClient();
  const issue = await githubClient.getIssue(owner, repo, issueNumber);

  const parsedHints = parseFileHintsFromIssue(issue.body);
  const requestedHints = (request.filePathHints ?? [])
    .filter(isWorkspaceRelativeFile)
    .map(normalizeWorkspaceRelative);
  const fileHints = dedupeStrings([
    ...requestedHints,
    ...parsedHints.explicit,
    ...parsedHints.inferred,
  ]);

  const context = await pickContextTarget(profile, fileHints, request.contextOptions);
  const recommendation = buildRecommendation(context);

  logInfo(
    'IssueFixLoop',
    `Issue analysis prepared for ${owner}/${repo}#${issueNumber} with target ${context.targetFile ?? 'n/a'}`,
  );

  return {
    mode: 'analysis-only',
    profile,
    issue: {
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body ?? '',
      issueState: issue.state,
      repositoryOwner: owner,
      repositoryName: repo,
      repositoryFullName: `${owner}/${repo}`,
      requestedAt: new Date().toISOString(),
      labels: issue.labels.map((label) => label.name),
      author: issue.user.login,
    },
    context,
    recommendation,
  };
}

export async function startIssueFixAttempt(
  request: IssueFixAttemptRequest,
  profile = loadDeveloperMcpProfile(),
): Promise<IssueFixAttemptStartResult> {
  ensureHydratedAttempts();
  const analysis = await analyzeIssueForFixLoop(request, profile);
  const pipeline = pipelineRunner.createPipeline(
    `issue fix attempt: ${analysis.issue.repositoryFullName}#${analysis.issue.issueNumber}`,
  );

  pipelineRunner.startPhase(pipeline.taskId, 'plan');
  pipelineRunner.completePhase(pipeline.taskId, 'plan', {
    analysisSummary: analysis.recommendation.summary,
    targetFile: analysis.context.targetFile,
    verificationCommands: analysis.recommendation.verificationCommands,
  });

  const approvalDescription = `Allow controlled fix attempt for ${analysis.issue.repositoryFullName}#${analysis.issue.issueNumber} (${analysis.issue.issueTitle})`;
  const approvalRequestId = await approvalManager.requestApproval(
    'critical_action',
    approvalDescription,
    {
      source: 'developer-issue-fix',
      taskId: pipeline.taskId,
      issueNumber: analysis.issue.issueNumber,
      repositoryFullName: analysis.issue.repositoryFullName,
      targetFile: analysis.context.targetFile,
      verificationCommands: analysis.recommendation.verificationCommands,
    },
    request.approvalTimeoutMs,
  );

  const now = new Date().toISOString();
  const attempt: IssueFixAttemptRecord = {
    taskId: pipeline.taskId,
    approvalRequestId,
    status: 'awaiting_approval',
    createdAt: now,
    updatedAt: now,
    issueNumber: analysis.issue.issueNumber,
    issueTitle: analysis.issue.issueTitle,
    repositoryFullName: analysis.issue.repositoryFullName,
    targetFile: analysis.context.targetFile,
    analysisSummary: analysis.recommendation.summary,
    verificationCommands: analysis.recommendation.verificationCommands,
  };
  issueFixAttemptAnalyses.set(pipeline.taskId, analysis);
  issueFixAttempts.set(pipeline.taskId, attempt);
  persistAttempt(pipeline.taskId);

  activityFeed.addActivity(
    'approval',
    'pipeline',
    `Issue fix attempt waiting for approval: ${analysis.issue.repositoryFullName}#${analysis.issue.issueNumber}`,
    {
      taskId: pipeline.taskId,
      approvalRequestId,
      targetFile: analysis.context.targetFile,
    },
  );

  rearmPendingAttempt(pipeline.taskId, analysis, approvalRequestId);

  return {
    taskId: pipeline.taskId,
    approvalRequestId,
    status: 'awaiting_approval',
    analysis,
  };
}

export function listIssueFixAttempts(): IssueFixAttemptRecord[] {
  ensureHydratedAttempts();
  return Array.from(issueFixAttempts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getIssueFixAttempt(taskId: string): IssueFixAttemptRecord | undefined {
  ensureHydratedAttempts();
  return issueFixAttempts.get(taskId);
}
