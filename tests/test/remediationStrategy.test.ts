import { describe, expect, it } from 'vitest';

import type { DeploymentAnalysis } from '../src/tools/deploymentAnalyzer.js';
import { buildVerificationPlan, selectRemediationFixerStrategy } from '../src/core/remediationStrategy.js';

function buildAnalysis(overrides: Partial<DeploymentAnalysis>): DeploymentAnalysis {
  return {
    type: 'unknown',
    category: 'unknown',
    title: 'Unknown Error',
    summary: 'Unknown deployment error',
    message: 'Unknown deployment error',
    rawError: 'Unknown deployment error',
    affectedFiles: [],
    confidence: 0.5,
    ...overrides,
  };
}

describe('remediationStrategy', () => {
  it('prefers lint_fixer for explicit lint failures and keeps Developer as fallback', () => {
    const strategy = selectRemediationFixerStrategy(
      buildAnalysis({
        category: 'lint',
        type: 'lint',
        title: 'Lint Error',
        summary: 'Linting checks failed',
        message: 'eslint reported violations',
        rawError: 'eslint src/index.ts',
        affectedFiles: ['src/index.ts'],
        confidence: 0.9,
      }),
    );

    expect(strategy.primary.agentName).toBe('lint_fixer');
    expect(strategy.fallback?.agentName).toBe('Developer');
    expect(strategy.primary.reason).toBe('lint_category');
  });

  it('treats lint-like build failures as specialized lint_fixer candidates', () => {
    const strategy = selectRemediationFixerStrategy(
      buildAnalysis({
        category: 'build',
        type: 'build',
        title: 'Build Error',
        summary: "'ScheduledTasksPanel' is declared but its value is never read",
        message: "'ScheduledTasksPanel' is declared but its value is never read",
        rawError: "error TS6133: 'ScheduledTasksPanel' is declared but its value is never read",
        affectedFiles: ['src/dashboard/components/dashboard/MissionControlLayout.tsx'],
        confidence: 0.9,
      }),
    );

    expect(strategy.primary.agentName).toBe('lint_fixer');
    expect(strategy.fallback?.agentName).toBe('Developer');
    expect(strategy.primary.reason).toBe('lint_like_failure');
  });

  it('keeps Developer as the primary fixer for test failures', () => {
    const strategy = selectRemediationFixerStrategy(
      buildAnalysis({
        category: 'test',
        type: 'test',
        title: 'Test Failed',
        summary: 'Unit tests failed - see logs for details',
        message: 'Expected 200, received 500',
        rawError: 'FAIL test/scheduledTasks.test.ts',
        affectedFiles: ['test/scheduledTasks.test.ts'],
        confidence: 0.8,
      }),
    );

    expect(strategy.primary.agentName).toBe('Developer');
    expect(strategy.fallback).toBeUndefined();
  });

  it('builds category-aware verification plans', () => {
    expect(buildVerificationPlan(buildAnalysis({ category: 'lint', type: 'lint' })).map((step) => step.name)).toEqual([
      'lint',
      'fast-test-suite',
    ]);

    expect(buildVerificationPlan(buildAnalysis({ category: 'test', type: 'test' })).map((step) => step.name)).toEqual([
      'fast-test-suite',
    ]);

    expect(buildVerificationPlan(buildAnalysis({ category: 'build', type: 'build' })).map((step) => step.name)).toEqual([
      'build',
      'fast-test-suite',
    ]);
  });
});
