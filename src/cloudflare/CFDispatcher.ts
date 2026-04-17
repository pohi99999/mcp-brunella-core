import { getCloudflareWorkersInventory, type WorkerDefinition } from "./cloudflareHelpers.js";

export type CFDispatchTarget =
  | "cf_worker"
  | "cf_queue"
  | "cf_kv"
  | "cf_d1"
  | "cf_ai_gateway"
  | "cf_vectorize"
  | "local";

export interface CFDispatchDecision {
  delegate: boolean;
  target: CFDispatchTarget;
  workerId?: string;
  reason: string;
  estimatedLatencyMs?: number;
}

export interface BrunellaTaskMeta {
  type: string;
  requiresLocalModel?: boolean;
  isAsync?: boolean;
  requiresExternalAPI?: boolean;
  involvesLLM?: boolean;
  isDataLookup?: boolean;
  isVectorSearch?: boolean;
  estimatedDurationMs?: number;
  agentName?: string;
  payload?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function lower(text: string | undefined): string {
  return (text || "").toLowerCase();
}

function getPayloadText(meta: BrunellaTaskMeta): string {
  const payloadString = meta.payload ? safeJsonStringify(meta.payload) : "";
  return [meta.agentName, meta.type, payloadString].filter(Boolean).join(" ").toLowerCase();
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function inferExplicitBoolean(meta: BrunellaTaskMeta, key: keyof BrunellaTaskMeta): boolean | undefined {
  return pickBoolean(meta[key]);
}

function inferEstimatedDurationMs(meta: BrunellaTaskMeta, payloadText: string): number {
  const explicit = pickNumber(meta.estimatedDurationMs);
  if (explicit !== undefined) {
    return explicit;
  }

  if (inferExplicitBoolean(meta, "isAsync") === true) {
    return 6000;
  }

  if (inferExplicitBoolean(meta, "isVectorSearch") === true) {
    return 120;
  }

  if (inferExplicitBoolean(meta, "isDataLookup") === true) {
    return /complex|join|report|aggregate|history|range|timeline/.test(payloadText) ? 250 : 75;
  }

  if (inferExplicitBoolean(meta, "involvesLLM") === true) {
    return 1200;
  }

  if (inferExplicitBoolean(meta, "requiresExternalAPI") === true) {
    return 500;
  }

  if (/research|harvest|extract|api|fetch|lookup|search|vector|embedding|queue|batch/.test(payloadText)) {
    return 500;
  }

  return 250;
}

function getDefaultTargetLatency(target: CFDispatchTarget): number {
  switch (target) {
    case "cf_vectorize":
      return 120;
    case "cf_kv":
      return 40;
    case "cf_d1":
      return 120;
    case "cf_ai_gateway":
      return 900;
    case "cf_queue":
      return 300;
    case "cf_worker":
      return 250;
    default:
      return 0;
  }
}

function normalizeAgentName(agentName?: string): string {
  return lower(agentName);
}

function getKeywordMatches(text: string): Record<string, boolean> {
  return {
    controlPlane: /edgeproxy|cloudflare|orchestrator|agentmanager|conductor|swarm|gateway/.test(text),
    researchFlow: /research|harvest|extract|browser|scrape|crawl|apify/.test(text),
    builderFlow: /builder|codegen|scaffold|developer|implement/.test(text),
    aiFlow: /llm|prompt|chat|reason|summar|generate|model|embedding/.test(text),
    lookupFlow: /lookup|query|search|fetch|get|read|list|inspect|history/.test(text),
    queueFlow: /queue|async|background|batch|pipeline|schedule|sync/.test(text),
    vectorFlow: /vector|embedding|semantic|rag|similarity|nearest/.test(text),
  };
}

export function buildBrunellaTaskMeta(
  agentName: string,
  type: string,
  payload?: Record<string, unknown>,
): BrunellaTaskMeta {
  const normalizedAgent = normalizeAgentName(agentName);
  const payloadRecord = isRecord(payload) ? payload : {};
  const payloadText = getPayloadText({ type, agentName, payload: payloadRecord });
  const keywordMatches = getKeywordMatches(`${normalizedAgent} ${payloadText}`);

  const explicitMeta = isRecord(payloadRecord.taskMeta) ? payloadRecord.taskMeta : null;
  const mergedExplicit = isRecord(explicitMeta) ? explicitMeta : {};

  const requiresLocalModel =
    pickBoolean(mergedExplicit.requiresLocalModel) ??
    (keywordMatches.controlPlane ||
      normalizedAgent.includes("builder") ||
      normalizedAgent.includes("localcsr"));

  const isVectorSearch =
    pickBoolean(mergedExplicit.isVectorSearch) ??
    keywordMatches.vectorFlow;

  const involvesLLM =
    pickBoolean(mergedExplicit.involvesLLM) ??
    keywordMatches.aiFlow;

  const isDataLookup =
    pickBoolean(mergedExplicit.isDataLookup) ??
    keywordMatches.lookupFlow;

  const isAsync =
    pickBoolean(mergedExplicit.isAsync) ??
    keywordMatches.queueFlow;

  const requiresExternalAPI =
    pickBoolean(mergedExplicit.requiresExternalAPI) ??
    (keywordMatches.researchFlow || /research-agent|harvest-agent|extract-agent/.test(normalizedAgent));

  const estimatedDurationMs = inferEstimatedDurationMs(
    {
      type,
      agentName,
      payload: payloadRecord,
      requiresLocalModel,
      isVectorSearch,
      involvesLLM,
      isDataLookup,
      isAsync,
      requiresExternalAPI,
      estimatedDurationMs: pickNumber(mergedExplicit.estimatedDurationMs),
    },
    payloadText,
  );

  return {
    type,
    agentName,
    payload: payloadRecord,
    requiresLocalModel,
    isVectorSearch,
    involvesLLM,
    isDataLookup,
    isAsync,
    requiresExternalAPI,
    estimatedDurationMs,
  };
}

function selectWorkerId(target: CFDispatchTarget, task: BrunellaTaskMeta): string | undefined {
  const inventory = getCloudflareWorkersInventory();
  const normalizedAgent = normalizeAgentName(task.agentName);

  const knownWorkers: Array<WorkerDefinition | undefined> = [];

  const findWorker = (...candidates: string[]): WorkerDefinition | undefined => {
    for (const candidate of candidates) {
      const worker = inventory.find((entry) => entry.id === candidate || entry.name === candidate);
      if (worker) {
        return worker;
      }
    }
    return undefined;
  };

  if (target === "cf_worker") {
    knownWorkers.push(
      /research|harvest|extract|browser|api/.test(normalizedAgent)
        ? findWorker("agents-api", "cean-orchestrator", "brunella-cf")
        : undefined,
      /orchestrator|conductor|swarm|queue|workflow|dispatch/.test(normalizedAgent)
        ? findWorker("cean-orchestrator", "chat-sync", "brunella-cf")
        : undefined,
      /llm|chat|prompt|gateway|model/.test(normalizedAgent)
        ? findWorker("llm-chat-app-template", "brunella-cf", "cean-orchestrator")
        : undefined,
      findWorker("agents-api", "cean-orchestrator", "brunella-cf", "llm-chat-app-template"),
    );
  } else if (target === "cf_ai_gateway") {
    knownWorkers.push(
      findWorker("llm-chat-app-template", "brunella-cf", "cean-orchestrator"),
    );
  } else {
    knownWorkers.push(
      findWorker("cean-orchestrator", "brunella-cf", "chat-sync"),
    );
  }

  const selected = knownWorkers.find((worker): worker is WorkerDefinition => Boolean(worker));
  return selected?.id;
}

export function shouldDelegate(task: BrunellaTaskMeta): CFDispatchDecision {
  const normalizedType = lower(task.type);
  const payloadText = getPayloadText(task);
  const estimatedDurationMs = inferEstimatedDurationMs(task, `${normalizedType} ${payloadText}`);

  if (task.requiresLocalModel === true) {
    return {
      delegate: false,
      target: "local",
      reason: "requiresLocalModel=true → local execution",
      estimatedLatencyMs: estimatedDurationMs,
    };
  }

  if (task.isVectorSearch === true || /vector|embedding|semantic|rag|similarity|nearest/.test(payloadText)) {
    return {
      delegate: true,
      target: "cf_vectorize",
      workerId: selectWorkerId("cf_vectorize", task),
      reason: "vector search delegated to Cloudflare Vectorize",
      estimatedLatencyMs: getDefaultTargetLatency("cf_vectorize"),
    };
  }

  if (task.involvesLLM === true || /llm|prompt|chat|reason|summar|generate|model|embedding/.test(payloadText)) {
    return {
      delegate: true,
      target: "cf_ai_gateway",
      workerId: selectWorkerId("cf_ai_gateway", task),
      reason: "LLM request proxied through Cloudflare AI gateway",
      estimatedLatencyMs: getDefaultTargetLatency("cf_ai_gateway"),
    };
  }

  if (task.isDataLookup === true && task.requiresExternalAPI !== true) {
    if (estimatedDurationMs < 100) {
      return {
        delegate: true,
        target: "cf_kv",
        workerId: selectWorkerId("cf_kv", task),
        reason: "fast data lookup routed to Cloudflare KV",
        estimatedLatencyMs: getDefaultTargetLatency("cf_kv"),
      };
    }

    return {
      delegate: true,
      target: "cf_d1",
      workerId: selectWorkerId("cf_d1", task),
      reason: "structured lookup routed to Cloudflare D1",
      estimatedLatencyMs: getDefaultTargetLatency("cf_d1"),
    };
  }

  if (task.isAsync === true || estimatedDurationMs > 5000) {
    return {
      delegate: true,
      target: "cf_queue",
      workerId: selectWorkerId("cf_queue", task),
      reason: "async or long-running task routed to Cloudflare Queues",
      estimatedLatencyMs: getDefaultTargetLatency("cf_queue"),
    };
  }

  if (task.requiresExternalAPI === true) {
    return {
      delegate: true,
      target: "cf_worker",
      workerId: selectWorkerId("cf_worker", task),
      reason: "external API work delegated to the best matching Cloudflare Worker",
      estimatedLatencyMs: getDefaultTargetLatency("cf_worker"),
    };
  }

  return {
    delegate: false,
    target: "local",
    reason: "no Cloudflare rule matched → local execution",
    estimatedLatencyMs: estimatedDurationMs,
  };
}
