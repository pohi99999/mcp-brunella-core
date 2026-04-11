import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { ensureError } from '../utils/ensureError.js';
import { logError } from '../utils/logger.js';

const DEFAULT_TIMEOUT_MS = 30_000;

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function calculateSuccessRate(results: SandboxRunResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  const passed = results.filter((item) => item.success).length;
  return roundMetric(passed / results.length);
}

function calculateAverageDuration(results: SandboxRunResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  const total = results.reduce((sum, item) => sum + item.durationMs, 0);
  return roundMetric(total / results.length);
}

export interface SandboxRunResult {
  input: string;
  success: boolean;
  durationMs: number;
  message?: string;
  error?: string;
}

export interface SandboxEvaluationResult {
  agentName: string;
  sampleCount: number;
  testsPassed: number;
  baselineSuccessRate: number;
  candidateSuccessRate: number;
  successRateDelta: number;
  baselineAvgDurationMs: number;
  avgDurationMs: number;
  durationImprovementPercent: number;
  improvementPercent: number;
  thresholdPassed: boolean;
  sandboxBackend: 'worker_threads';
  baselineRuns: SandboxRunResult[];
  candidateRuns: SandboxRunResult[];
}

export interface SandboxTestOptions {
  timeoutMs?: number;
  sandboxRoot?: string;
  context?: Record<string, unknown>;
}

export interface SelfModificationSandboxRequest {
  agentName: string;
  baselineToml: string;
  candidateToml: string;
  testInputs: string[];
  timeoutMs: number;
  sandboxRoot: string;
  context?: Record<string, unknown>;
}

interface SandboxWorkerSuccessResponse {
  baselineRuns?: SandboxRunResult[];
  candidateRuns?: SandboxRunResult[];
  error?: undefined;
}

interface SandboxWorkerErrorResponse {
  error: string;
  baselineRuns?: undefined;
  candidateRuns?: undefined;
}

export type SelfModificationSandboxWorkerResponse =
  | SandboxWorkerSuccessResponse
  | SandboxWorkerErrorResponse;

class SandboxManager {
  private resolveWorkerPath(): URL {
    return new URL('../workers/selfModificationSandboxWorker.js', import.meta.url);
  }

  private async runWorker(
    request: SelfModificationSandboxRequest,
  ): Promise<SelfModificationSandboxWorkerResponse> {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(this.resolveWorkerPath(), {
        workerData: request,
      });

      const cleanup = () => {
        worker.removeAllListeners();
        void worker.terminate();
      };

      worker.once('message', (message: SelfModificationSandboxWorkerResponse) => {
        cleanup();
        resolve(message);
      });

      worker.once('error', (error) => {
        cleanup();
        reject(error);
      });

      worker.once('exit', (code) => {
        if (code !== 0) {
          cleanup();
          reject(new Error(`Sandbox worker exited with code ${code}`));
        }
      });
    });
  }

  async testAgent(
    agentName: string,
    baselineToml: string,
    candidateToml: string,
    testInputs: string[],
    options?: SandboxTestOptions,
  ): Promise<SandboxEvaluationResult> {
    if (testInputs.length === 0) {
      throw new Error('SandboxManager.testAgent requires at least one test input.');
    }

    const timeoutMs = Math.max(1_000, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const sandboxRoot = options?.sandboxRoot
      ? path.resolve(options.sandboxRoot)
      : process.cwd();
    const request: SelfModificationSandboxRequest = {
      agentName,
      baselineToml,
      candidateToml,
      testInputs,
      timeoutMs,
      sandboxRoot,
      context: options?.context,
    };

    try {
      const response = await this.runWorker(request);
      if ('error' in response && response.error) {
        throw new Error(response.error);
      }

      const baselineRuns = response.baselineRuns ?? [];
      const candidateRuns = response.candidateRuns ?? [];
      const baselineSuccessRate = calculateSuccessRate(baselineRuns);
      const candidateSuccessRate = calculateSuccessRate(candidateRuns);
      const successRateDelta = roundMetric(candidateSuccessRate - baselineSuccessRate);
      const baselineAvgDurationMs = calculateAverageDuration(baselineRuns);
      const avgDurationMs = calculateAverageDuration(candidateRuns);
      const durationImprovementPercent = baselineAvgDurationMs > 0
        ? roundMetric((baselineAvgDurationMs - avgDurationMs) / baselineAvgDurationMs)
        : 0;
      const nonRegressingSuccess = candidateSuccessRate >= baselineSuccessRate;
      const improvementPercent = roundMetric(
        Math.max(successRateDelta * 100, durationImprovementPercent * 100),
      );
      const testsPassed = candidateRuns.filter((item) => item.success).length;
      const thresholdPassed = successRateDelta >= 0.1
        || (durationImprovementPercent >= 0.2 && nonRegressingSuccess);

      return {
        agentName,
        sampleCount: candidateRuns.length,
        testsPassed,
        baselineSuccessRate,
        candidateSuccessRate,
        successRateDelta,
        baselineAvgDurationMs,
        avgDurationMs,
        durationImprovementPercent,
        improvementPercent,
        thresholdPassed,
        sandboxBackend: 'worker_threads',
        baselineRuns,
        candidateRuns,
      };
    } catch (error) {
      const normalized = ensureError(error);
      logError('SandboxManager', `testAgent failed for ${agentName}: ${normalized.message}`);
      throw normalized;
    }
  }
}

export const sandboxManager = new SandboxManager();
