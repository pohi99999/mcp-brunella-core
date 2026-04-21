import { parentPort, workerData } from 'node:worker_threads';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DynamicAgent } from '@packages/agents/DynamicAgent.js';
import type { AgentResponse } from '@packages/agents/types.js';
import type {
  SandboxRunResult,
  SelfModificationSandboxRequest,
  SelfModificationSandboxWorkerResponse,
} from '@packages/core-logic/sandboxManager.js';

function getParentPort() {
  if (!parentPort) {
    throw new Error('Sandbox worker must run inside worker_threads.');
  }

  return parentPort;
}

function buildContext(
  sandboxRoot: string,
  inputContext?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    sandbox: true,
    target_path: sandboxRoot,
    ...(inputContext ?? {}),
  };
}

function isAgentResponse(value: unknown): value is AgentResponse {
  return typeof value === 'object' && value !== null && 'status' in value;
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Sandbox test timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runAgentSuite(
  label: 'baseline' | 'candidate',
  request: SelfModificationSandboxRequest,
  sandboxDir: string,
): Promise<SandboxRunResult[]> {
  const tomlPath = join(sandboxDir, `${label}.toml`);
  await writeFile(
    tomlPath,
    label === 'baseline' ? request.baselineToml : request.candidateToml,
    'utf-8',
  );

  const agent = new DynamicAgent(tomlPath);
  const results: SandboxRunResult[] = [];
  const context = buildContext(request.sandboxRoot, request.context);

  for (const input of request.testInputs) {
    const startedAt = Date.now();
    try {
      const response = await runWithTimeout(
        agent.execute(input, context),
        request.timeoutMs,
      );
      const payload = isAgentResponse(response) ? response : undefined;
      results.push({
        input,
        success: payload?.success !== false && payload?.status !== 'error',
        durationMs: Date.now() - startedAt,
        message: typeof payload?.message === 'string'
          ? payload.message
          : typeof payload?.data === 'string'
            ? payload.data
            : undefined,
      });
    } catch (error) {
      results.push({
        input,
        success: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function main(): Promise<SelfModificationSandboxWorkerResponse> {
  const request = workerData as SelfModificationSandboxRequest;
  const sandboxDir = await mkdtemp(join(tmpdir(), 'brunella-selfmod-'));

  try {
    const baselineRuns = await runAgentSuite('baseline', request, sandboxDir);
    const candidateRuns = await runAgentSuite('candidate', request, sandboxDir);
    return {
      baselineRuns,
      candidateRuns,
    };
  } finally {
    await rm(sandboxDir, { recursive: true, force: true });
  }
}

const port = getParentPort();

void main()
  .then((result) => {
    port.postMessage(result);
  })
  .catch((error) => {
    port.postMessage({
      error: error instanceof Error ? error.message : String(error),
    } satisfies SelfModificationSandboxWorkerResponse);
  });

