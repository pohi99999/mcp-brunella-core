import { getCloudflareAuthHeaders, getCloudflareOrchestratorUrl } from "@packages/utils/cloudflareConfig.js";
import { logDebug, logInfo, logWarn } from "@packages/utils/logger.js";
import { recordCloudflareDispatchOutcome } from "@packages/utils/metrics.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { shouldDelegate, type BrunellaTaskMeta, type CFDispatchDecision } from "./CFDispatcher.js";
import {
  getCloudflareWorkersInventory,
  postTaskToWorker,
  type WorkerDefinition,
} from "./cloudflareHelpers.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function extractInstruction(task: BrunellaTaskMeta): string {
  const payload = isRecord(task.payload) ? task.payload : {};
  return (
    pickString(
      payload.instruction,
      payload.task,
      payload.message,
      task.type,
      task.agentName,
    ) || task.type || task.agentName || "cloudflare task"
  );
}

function extractContext(task: BrunellaTaskMeta): Record<string, unknown> {
  const payload = isRecord(task.payload) ? task.payload : {};
  const context = isRecord(payload.context) ? payload.context : {};
  return {
    ...payload,
    context,
  };
}

function resolveWorker(workerId?: string): WorkerDefinition | undefined {
  if (!workerId) {
    return undefined;
  }

  return getCloudflareWorkersInventory().find((worker) => worker.id === workerId || worker.name === workerId);
}

function normalizeRemoteResult<T>(response: unknown, fallbackDecision: CFDispatchDecision): T {
  if (isRecord(response)) {
    if ("result" in response && response.result !== undefined) {
      return response.result as T;
    }

    if (response.queued === true) {
      return {
        success: true,
        status: "queued",
        message: `Cloudflare queue accepted (${response.taskId || fallbackDecision.target})`,
        data: response,
      } as T;
    }
  }

  return response as T;
}

async function dispatchThroughCloudflare(task: BrunellaTaskMeta, decision: CFDispatchDecision): Promise<unknown> {
  const instruction = extractInstruction(task);
  const context = extractContext(task);

  if (decision.target === "cf_worker") {
    const worker = resolveWorker(decision.workerId);
    if (!worker) {
      throw new Error(`No Cloudflare worker found for ${decision.workerId || "unknown"}`);
    }

    const result = await postTaskToWorker(worker, instruction, context);
    if (!result.success) {
      throw new Error(result.error || `Worker dispatch failed for ${worker.id}`);
    }

    return result.result ?? result;
  }

  const baseUrl = getCloudflareOrchestratorUrl();
  const headers = getCloudflareAuthHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(`${baseUrl}/dispatch-smart`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskMeta: task,
        payload: {
          instruction,
          ...context,
        },
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) as unknown : "";
    } catch (error: unknown) {
      logDebug("CFDispatchMiddleware", `dispatch-smart JSON parse skipped: ${ensureError(error).message}`);
    }

    if (!response.ok) {
      const detail = isRecord(parsed) && typeof parsed.error === "string" ? parsed.error : text;
      throw new Error(detail || `dispatch-smart failed with HTTP ${response.status}`);
    }

    return normalizeRemoteResult<unknown>(parsed, decision);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function withCFDispatch<T>(
  task: BrunellaTaskMeta,
  localFallback: () => Promise<T>,
): Promise<T> {
  const decision = shouldDelegate(task);
  const target = decision.target;

  if (!decision.delegate || target === "local") {
    recordCloudflareDispatchOutcome(target, "local");
    logInfo("CFDispatchMiddleware", `Local execution retained: ${task.agentName || task.type} (${decision.reason})`);
    return localFallback();
  }

  const startedAt = Date.now();
  logInfo(
    "CFDispatchMiddleware",
    `Delegating ${task.agentName || task.type} to ${target}${decision.workerId ? ` (${decision.workerId})` : ""}: ${decision.reason}`,
  );

  try {
    const remote = await dispatchThroughCloudflare(task, decision);
    recordCloudflareDispatchOutcome(target, "cf", Date.now() - startedAt);
    return normalizeRemoteResult<T>(remote, decision);
  } catch (error: unknown) {
    const err = ensureError(error);
    recordCloudflareDispatchOutcome(target, "fallback", Date.now() - startedAt);
    logWarn(
      "CFDispatchMiddleware",
      `CF delegation failed for ${task.agentName || task.type} (${target}); falling back locally: ${err.message}`,
    );
    return localFallback();
  }
}

