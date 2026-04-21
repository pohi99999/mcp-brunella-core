import type { DeploymentAnalysis } from '@packages/utils/deploymentAnalyzer.js';

export interface VerificationCommandPlan {
  name: string;
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface RemediationFixerCandidate {
  agentName: string;
  task: string;
  reason: string;
}

export interface RemediationFixerStrategy {
  primary: RemediationFixerCandidate;
  fallback?: RemediationFixerCandidate;
}

function truncate(text: string | undefined, limit = 1200): string | undefined {
  if (!text) {
    return undefined;
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function buildFocusSuffix(affectedFiles: string[]): string {
  return affectedFiles.length > 0 ? ` Focus files: ${affectedFiles.join(', ')}.` : '';
}

function buildDeveloperTask(
  analysis: DeploymentAnalysis | undefined,
  category: string,
  focus: string,
  errorDetails: string,
): string {
  return [
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
}

function buildLintFixerTask(
  analysis: DeploymentAnalysis | undefined,
  focus: string,
  errorDetails: string,
): string {
  const affectedFiles = analysis?.affectedFiles ?? [];
  const targetFile = affectedFiles.length === 1 ? ` ${affectedFiles[0]}` : '';
  return `fix${targetFile} lint or static-analysis issues from GitHub workflow failure.${focus} Error details: ${errorDetails}`;
}

function isLintLikeFailure(analysis?: DeploymentAnalysis): boolean {
  if (!analysis) {
    return false;
  }

  if (analysis.category === 'lint') {
    return true;
  }

  const combinedText = [
    analysis.title,
    analysis.summary,
    analysis.message,
    analysis.rawError,
    ...(analysis.errors ?? []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ');

  return /(eslint|prettier|stylelint|no-unused-vars|declared but its value is never read|assigned a value but never used|formatting|unused import)/i.test(
    combinedText,
  );
}

export function buildVerificationPlan(analysis?: DeploymentAnalysis): VerificationCommandPlan[] {
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

export function selectRemediationFixerStrategy(
  analysis?: DeploymentAnalysis,
): RemediationFixerStrategy {
  const category = analysis?.category ?? 'unknown';
  const affectedFiles = analysis?.affectedFiles ?? [];
  const focus = buildFocusSuffix(affectedFiles);
  const errorDetails = analysis?.errors?.slice(0, 3).join(' | ') ?? analysis?.message ?? 'Unknown workflow failure';
  const developerTask = buildDeveloperTask(analysis, category, focus, errorDetails);

  if (isLintLikeFailure(analysis)) {
    return {
      primary: {
        agentName: 'lint_fixer',
        task: buildLintFixerTask(analysis, focus, errorDetails),
        reason: category === 'lint' ? 'lint_category' : 'lint_like_failure',
      },
      fallback: {
        agentName: 'Developer',
        task: developerTask,
        reason: 'developer_fallback_after_specialized_failure',
      },
    };
  }

  return {
    primary: {
      agentName: 'Developer',
      task: developerTask,
      reason: `developer_primary_${category}`,
    },
  };
}

