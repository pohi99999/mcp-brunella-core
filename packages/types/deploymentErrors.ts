/**
 * Deployment Error Types
 * 
 * Defines structured error formats for GitHub workflow failures
 */

export type ErrorCategory = 'build' | 'test' | 'lint' | 'deploy' | 'unknown';

export interface ErrorLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface DeploymentError {
  id: string;
  workflowRunId: number;
  repository: {
    name: string;
    owner: string;
    url: string;
  };
  workflow: {
    name: string;
    path: string;
    branch: string;
  };
  category: ErrorCategory;
  title: string;
  message: string;
  stackTrace?: string;
  location?: ErrorLocation;
  timestamp: string;
  logs: {
    full: string;
    relevant: string; // Trimmed to ~500 chars around error
  };
  context: {
    affectedFiles: string[];
    recentCommits: Array<{
      sha: string;
      message: string;
      author: string;
      timestamp: string;
    }>;
  };
}

export interface JulesFixPrompt {
  error: DeploymentError;
  prompt: string;
  examples?: string[];
  confidenceScore: number; // 0-1
}

export interface WorkflowAnalysisResult {
  success: boolean;
  error?: DeploymentError;
  prompt?: JulesFixPrompt;
  message?: string;
}

/**
 * Error type patterns for detection
 */
export const ERROR_PATTERNS = {
  build: [
    /error TS\d+:/i, // TypeScript errors
    /error:.*(failed to.*compile|build error)/i,
    /compilation failed/i,
    /module not found/i
  ],
  test: [
    /test failed/i,
    /assertion.*failed/i,
    /expect\(.*\)\.to/i,
    / failing( test)?/i,
    /mocha|jest|vitest/i
  ],
  lint: [
    /eslint|prettier|stylelint/i,
    /linting.*failed/i,
    /✖/i // ESLint failure marker
  ],
  deploy: [
    /deployment.*failed/i,
    /(push|pull|clone).*(failed|error)/i,
    /remote:.*error/i,
    /npm.*publish.*(error|failed)/i
  ]
};
