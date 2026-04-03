import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  getRuntimeTelemetry,
  type RuntimeBudgetState,
  type RuntimeMemoryState,
  type RuntimeTelemetry,
} from "./runtimeTelemetry.js";
import { Logger } from "./logger.js";

export type PythonRuntimeStatus = "healthy" | "degraded" | "unavailable";
export type PythonMemoryState = RuntimeMemoryState | "unknown";
export type RuntimeDriftState = "collecting" | "healthy" | "warn" | "critical";
export type RuntimeRecommendationAction = "keep" | "observe" | "align" | "tune";
export type RuntimeRecommendationConfidence = "low" | "medium" | "high";

export interface NodeRuntimeRecommendationBudget {
  heapMb: number | null;
  runtimeLimitMb: number | null;
  restartThresholdMb: number | null;
}

export interface PythonRuntimeRecommendationBudget {
  memoryLimitMb: number | null;
}

export interface RuntimeTuningRecommendation {
  overallAction: RuntimeRecommendationAction;
  confidence: RuntimeRecommendationConfidence;
  rationale: string;
  signals: string[];
  node: {
    action: RuntimeRecommendationAction;
    rationale: string;
    current: NodeRuntimeRecommendationBudget;
    suggested: NodeRuntimeRecommendationBudget;
  };
  python: {
    action: RuntimeRecommendationAction;
    rationale: string;
    current: PythonRuntimeRecommendationBudget;
    suggested: PythonRuntimeRecommendationBudget;
  };
}

export interface PythonRuntimeTelemetry {
  status: PythonRuntimeStatus;
  pid: number | null;
  uptimeSeconds: number | null;
  memoryRssMb: number | null;
  memoryLimitMb: number | null;
  memoryState: PythonMemoryState;
  error?: string;
}

export interface RuntimeDriftSample {
  timestamp: string;
  node: RuntimeTelemetry;
  python: PythonRuntimeTelemetry;
}

export interface RuntimeDriftSummary {
  overallState: RuntimeDriftState;
  sampleCount: number;
  windowMinutes: number;
  lastSampleAt: string | null;
  recommendation: RuntimeTuningRecommendation;
  node: {
    currentState: RuntimeMemoryState | null;
    currentBudgetState: RuntimeBudgetState | "none";
    currentHeapUtilizationPercent: number | null;
    maxHeapUtilizationPercent: number | null;
    maxHeapUsedMb: number | null;
    restartCount: number;
    driftCount: number;
  };
  python: {
    status: PythonRuntimeStatus;
    currentState: PythonMemoryState;
    currentMemoryRssMb: number | null;
    maxMemoryRssMb: number | null;
    restartCount: number;
    unavailableCount: number;
    pid: number | null;
    error?: string;
  };
}

export interface RuntimeDriftSnapshot {
  summary: RuntimeDriftSummary;
  samples: RuntimeDriftSample[];
}

const driftLogger = new Logger("runtime_drift.log");
const DEFAULT_HISTORY_FILE = path.join(
  process.cwd(),
  "data",
  "runtime-drift-history.json",
);
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_SAMPLES = 180;
const RESTART_UPTIME_TOLERANCE_SECONDS = 5;
const MIN_RECOMMENDATION_SAMPLES = 8;
const MIN_RECOMMENDATION_WINDOW_MINUTES = 15;
const NODE_TUNE_STEP_MB = 256;
const NODE_SEVERE_TUNE_STEP_MB = 512;
const NODE_HEADROOM_MB = 512;
const NODE_RESTART_BUFFER_MB = 256;
const PYTHON_TUNE_STEP_MB = 128;
const PYTHON_SEVERE_TUNE_STEP_MB = 256;

let historyLoaded = false;
let sampleHistory: RuntimeDriftSample[] = [];
let monitorTimer: ReturnType<typeof setInterval> | null = null;
let startPromise: Promise<void> | null = null;

function getHistoryFilePath(): string {
  return process.env.BRUNELLA_RUNTIME_DRIFT_FILE || DEFAULT_HISTORY_FILE;
}

function getSamplingIntervalMs(): number {
  const raw = Number(process.env.BRUNELLA_RUNTIME_DRIFT_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 5_000 ? raw : DEFAULT_INTERVAL_MS;
}

function getMaxSamples(): number {
  const raw = Number(process.env.BRUNELLA_RUNTIME_DRIFT_MAX_SAMPLES);
  return Number.isFinite(raw) && raw >= 10 ? Math.round(raw) : DEFAULT_MAX_SAMPLES;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRuntimeMemoryState(value: unknown): value is RuntimeMemoryState {
  return value === "healthy" || value === "warn" || value === "critical";
}

function isRuntimeBudgetState(value: unknown): value is RuntimeBudgetState {
  return (
    value === "aligned" ||
    value === "drift" ||
    value === "invalid" ||
    value === "unconfigured"
  );
}

function isPythonRuntimeStatus(value: unknown): value is PythonRuntimeStatus {
  return value === "healthy" || value === "degraded" || value === "unavailable";
}

function hasValidNodeTelemetry(value: unknown): value is RuntimeTelemetry {
  if (!isObject(value) || !isObject(value.memory)) {
    return false;
  }

  return (
    typeof value.pid === "number" &&
    typeof value.uptimeSeconds === "number" &&
    typeof value.memory.heapUtilizationPercent === "number" &&
    isRuntimeMemoryState(value.memory.state)
  );
}

function hasValidPythonTelemetry(value: unknown): value is PythonRuntimeTelemetry {
  if (!isObject(value)) {
    return false;
  }

  return (
    isPythonRuntimeStatus(value.status) &&
    (value.pid === null || typeof value.pid === "number") &&
    (value.uptimeSeconds === null || typeof value.uptimeSeconds === "number") &&
    (value.memoryRssMb === null || typeof value.memoryRssMb === "number") &&
    (value.memoryLimitMb === null || typeof value.memoryLimitMb === "number") &&
    (value.memoryState === "unknown" || isRuntimeMemoryState(value.memoryState))
  );
}

function isRuntimeDriftSample(value: unknown): value is RuntimeDriftSample {
  return (
    isObject(value) &&
    typeof value.timestamp === "string" &&
    hasValidNodeTelemetry(value.node) &&
    hasValidPythonTelemetry(value.python)
  );
}

function trimSamples(samples: RuntimeDriftSample[]): RuntimeDriftSample[] {
  const maxSamples = getMaxSamples();
  return samples.length > maxSamples ? samples.slice(-maxSamples) : samples;
}

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function normalizeNodeBudget(
  sample: RuntimeDriftSample,
): NodeRuntimeRecommendationBudget {
  return {
    heapMb: sample.node.budget?.configuredHeapMb ?? null,
    runtimeLimitMb: sample.node.budget?.runtimeMemoryLimitMb ?? null,
    restartThresholdMb: sample.node.budget?.restartThresholdMb ?? null,
  };
}

function normalizePythonBudget(
  sample: RuntimeDriftSample,
): PythonRuntimeRecommendationBudget {
  return {
    memoryLimitMb: sample.python.memoryLimitMb,
  };
}

function hasEnoughRecommendationData(
  sampleCount: number,
  windowMinutes: number,
): boolean {
  return (
    sampleCount >= MIN_RECOMMENDATION_SAMPLES &&
    windowMinutes >= MIN_RECOMMENDATION_WINDOW_MINUTES
  );
}

function buildObservationRecommendation(
  latest: RuntimeDriftSample | null,
  reason: string,
  signal: string,
): RuntimeTuningRecommendation {
  const nodeBudget = latest ? normalizeNodeBudget(latest) : {
    heapMb: null,
    runtimeLimitMb: null,
    restartThresholdMb: null,
  };
  const pythonBudget = latest ? normalizePythonBudget(latest) : {
    memoryLimitMb: null,
  };

  return {
    overallAction: "observe",
    confidence: "low",
    rationale: reason,
    signals: [signal],
    node: {
      action: "observe",
      rationale: reason,
      current: nodeBudget,
      suggested: nodeBudget,
    },
    python: {
      action: "observe",
      rationale: reason,
      current: pythonBudget,
      suggested: pythonBudget,
    },
  };
}

function buildNodeTuneSuggestion(
  current: NodeRuntimeRecommendationBudget,
  maxHeapUsedMb: number,
  severePressure: boolean,
): NodeRuntimeRecommendationBudget {
  const currentHeapMb =
    current.heapMb ?? roundUpToStep(maxHeapUsedMb, NODE_TUNE_STEP_MB);
  const suggestedHeapMb = roundUpToStep(
    Math.max(
      currentHeapMb +
        (severePressure ? NODE_SEVERE_TUNE_STEP_MB : NODE_TUNE_STEP_MB),
      maxHeapUsedMb * 1.2,
    ),
    NODE_TUNE_STEP_MB,
  );
  const suggestedRuntimeLimitMb = roundUpToStep(
    Math.max(
      current.runtimeLimitMb ?? currentHeapMb + NODE_HEADROOM_MB,
      suggestedHeapMb + NODE_HEADROOM_MB,
    ),
    NODE_TUNE_STEP_MB,
  );
  const suggestedRestartThresholdMb = Math.min(
    suggestedRuntimeLimitMb - 128,
    suggestedHeapMb + NODE_RESTART_BUFFER_MB,
  );

  return {
    heapMb: suggestedHeapMb,
    runtimeLimitMb: suggestedRuntimeLimitMb,
    restartThresholdMb: suggestedRestartThresholdMb,
  };
}

function buildNodeAlignSuggestion(
  current: NodeRuntimeRecommendationBudget,
  effectiveHeapLimitMb: number | null,
): NodeRuntimeRecommendationBudget {
  const alignedHeapMb = roundUpToStep(
    effectiveHeapLimitMb ?? current.heapMb ?? 1536,
    NODE_TUNE_STEP_MB,
  );
  const alignedRuntimeLimitMb = roundUpToStep(
    Math.max(current.runtimeLimitMb ?? alignedHeapMb + NODE_HEADROOM_MB, alignedHeapMb + NODE_HEADROOM_MB),
    NODE_TUNE_STEP_MB,
  );
  const alignedRestartThresholdMb = Math.min(
    alignedRuntimeLimitMb - 128,
    alignedHeapMb + NODE_RESTART_BUFFER_MB,
  );

  return {
    heapMb: alignedHeapMb,
    runtimeLimitMb: alignedRuntimeLimitMb,
    restartThresholdMb: alignedRestartThresholdMb,
  };
}

function buildPythonTuneSuggestion(
  current: PythonRuntimeRecommendationBudget,
  maxPythonMemoryRssMb: number,
  severePressure: boolean,
): PythonRuntimeRecommendationBudget {
  const currentLimitMb =
    current.memoryLimitMb ?? roundUpToStep(maxPythonMemoryRssMb, PYTHON_TUNE_STEP_MB);
  const suggestedLimitMb = roundUpToStep(
    Math.max(
      currentLimitMb +
        (severePressure ? PYTHON_SEVERE_TUNE_STEP_MB : PYTHON_TUNE_STEP_MB),
      maxPythonMemoryRssMb * 1.25,
    ),
    PYTHON_TUNE_STEP_MB,
  );

  return {
    memoryLimitMb: suggestedLimitMb,
  };
}

interface RuntimeRecommendationMetrics {
  latest: RuntimeDriftSample;
  sampleCount: number;
  windowMinutes: number;
  nodeRestartCount: number;
  pythonRestartCount: number;
  maxHeapUtilizationPercent: number;
  maxHeapUsedMb: number;
  maxPythonMemoryRssMb: number | null;
  unavailableCount: number;
}

export function buildRuntimeTuningRecommendation(
  metrics: RuntimeRecommendationMetrics,
): RuntimeTuningRecommendation {
  if (
    !hasEnoughRecommendationData(metrics.sampleCount, metrics.windowMinutes)
  ) {
    return buildObservationRecommendation(
      metrics.latest,
      "Meg tovabbi stabil mintak kellenek a biztonsagos threshold tuninghoz.",
      "insufficient_observation_window",
    );
  }

  const currentNodeBudget = normalizeNodeBudget(metrics.latest);
  const currentPythonBudget = normalizePythonBudget(metrics.latest);
  const currentBudgetState = metrics.latest.node.budget?.state ?? "none";
  const nodeCurrentState = metrics.latest.node.memory.state;
  const pythonCurrentState = metrics.latest.python.memoryState;
  const pythonLimitMb = currentPythonBudget.memoryLimitMb;
  const effectiveNodeHeapLimitMb =
    metrics.latest.node.budget?.effectiveHeapLimitMb ?? currentNodeBudget.heapMb;
  const pythonMaxRatio =
    pythonLimitMb !== null &&
    metrics.maxPythonMemoryRssMb !== null &&
    pythonLimitMb > 0
      ? metrics.maxPythonMemoryRssMb / pythonLimitMb
      : 0;
  const nodePressure =
    metrics.nodeRestartCount > 0 ||
    nodeCurrentState === "warn" ||
    nodeCurrentState === "critical" ||
    metrics.maxHeapUtilizationPercent >= 82;
  const severeNodePressure =
    metrics.nodeRestartCount > 1 ||
    nodeCurrentState === "critical" ||
    metrics.maxHeapUtilizationPercent >= 92;
  const pythonMemoryPressure =
    pythonCurrentState === "warn" ||
    pythonCurrentState === "critical" ||
    pythonMaxRatio >= 0.82;
  const severePythonPressure =
    pythonCurrentState === "critical" ||
    pythonMaxRatio >= 0.9;

  let nodeAction: RuntimeRecommendationAction = "keep";
  let nodeRationale =
    "A Node envelope jelenleg eleg headroomot tart, most nem kell finomhangolni.";
  let nodeSuggested = currentNodeBudget;
  const signals: string[] = [];

  if (currentBudgetState === "none") {
    nodeAction = "observe";
    nodeRationale =
      "A stable launcher contract nem latszik a mintakban, ezert elobb tovabbi valid mintakat kell gyujteni.";
    signals.push("node_contract_missing");
  } else if (currentBudgetState === "drift" || currentBudgetState === "invalid") {
    nodeAction = "align";
    nodeRationale =
      "A Node launcher contract nincs szinkronban a futo heap budgettel; elobb ezt kell helyreigazitani.";
    nodeSuggested = buildNodeAlignSuggestion(
      currentNodeBudget,
      effectiveNodeHeapLimitMb,
    );
    signals.push("node_contract_misaligned");
  } else if (nodePressure) {
    nodeAction = "tune";
    nodeRationale =
      "A Node mintak restartot vagy magas heap kihasznaltsagot mutatnak, ezert ovatos budget emeles indokolt.";
    nodeSuggested = buildNodeTuneSuggestion(
      currentNodeBudget,
      metrics.maxHeapUsedMb,
      severeNodePressure,
    );
    signals.push(
      metrics.nodeRestartCount > 0 ? "node_restart_detected" : "node_heap_pressure",
    );
  }

  let pythonAction: RuntimeRecommendationAction = "keep";
  let pythonRationale =
    "A Python runtime memoria-headroom stabil, nem kell most limitet emelni.";
  let pythonSuggested = currentPythonBudget;

  if (
    metrics.latest.python.status === "unavailable" ||
    metrics.unavailableCount > 0
  ) {
    if (!pythonMemoryPressure) {
      pythonAction = "observe";
      pythonRationale =
        "A Python kiesesek mellett meg tovabbi mintat kell gyujteni, mielott memoria-limitet modositanank.";
      signals.push("python_unavailable");
    } else if (metrics.maxPythonMemoryRssMb !== null) {
      pythonAction = "tune";
      pythonRationale =
        "A Python kieses memoria-nyomassal egyutt jelentkezik, ezert mersekelt limitemeles javasolt.";
      pythonSuggested = buildPythonTuneSuggestion(
        currentPythonBudget,
        metrics.maxPythonMemoryRssMb,
        severePythonPressure,
      );
      signals.push("python_memory_pressure");
    }
  } else if (pythonMemoryPressure && metrics.maxPythonMemoryRssMb !== null) {
    pythonAction = "tune";
    pythonRationale =
      "A Python memoria-kihasznaltsag tartosan magas, ezert erdemes ovatosan emelni a stable limitet.";
    pythonSuggested = buildPythonTuneSuggestion(
      currentPythonBudget,
      metrics.maxPythonMemoryRssMb,
      severePythonPressure,
    );
    signals.push("python_memory_pressure");
  } else if (metrics.pythonRestartCount > 0) {
    pythonAction = "observe";
    pythonRationale =
      "A Python restartok latszanak, de a memoria-nyomas nem eleg eros ahhoz, hogy automatikus tuningot javasoljunk.";
    signals.push("python_restart_without_memory_pressure");
  }

  let overallAction: RuntimeRecommendationAction = "keep";
  let rationale =
    "A jelenlegi stable runtime envelope kiegyensulyozott, csak tovabbi megfigyeles szukseges.";

  if (nodeAction === "align") {
    overallAction = "align";
    rationale =
      "Elobb a Node launcher contractot kell a stable envelope-hoz igazitani, utana erdemes threshold tuningot nezni.";
  } else if (nodeAction === "tune" || pythonAction === "tune") {
    overallAction = "tune";
    rationale =
      nodeAction === "tune" && pythonAction === "tune"
        ? "A Node es a Python is memoria- vagy restartnyomast mutat, ezert ovatos budget tuning javasolt."
        : nodeAction === "tune"
          ? "A Node control plane memoria-nyomast mutat, ezert ovatos heap es restart-threshold tuning javasolt."
          : "A Python runtime memoria-nyomast mutat, ezert ovatos limitemeles javasolt.";
  } else if (nodeAction === "observe" || pythonAction === "observe") {
    overallAction = "observe";
    rationale =
      pythonAction === "observe"
        ? pythonRationale
        : "Meg tovabbi stabil mintak kellenek a biztonsagos threshold tuninghoz.";
  }

  const confidence: RuntimeRecommendationConfidence =
    overallAction === "observe"
      ? "low"
      : overallAction === "align"
        ? "high"
        : overallAction === "tune"
          ? signals.length > 1
            ? "high"
            : "medium"
          : metrics.windowMinutes >= 30
            ? "high"
            : "medium";

  if (signals.length === 0) {
    signals.push("stable_headroom");
  }

  return {
    overallAction,
    confidence,
    rationale,
    signals,
    node: {
      action: nodeAction,
      rationale: nodeRationale,
      current: currentNodeBudget,
      suggested: nodeSuggested,
    },
    python: {
      action: pythonAction,
      rationale: pythonRationale,
      current: currentPythonBudget,
      suggested: pythonSuggested,
    },
  };
}

function loadHistoryOnce(): void {
  if (historyLoaded) {
    return;
  }

  historyLoaded = true;
  const filePath = getHistoryFilePath();
  if (!existsSync(filePath)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    if (Array.isArray(parsed)) {
      sampleHistory = trimSamples(parsed.filter(isRuntimeDriftSample));
    }
  } catch (error) {
    driftLogger.warn(
      `Failed to load runtime drift history: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function persistHistory(): void {
  try {
    const filePath = getHistoryFilePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(sampleHistory, null, 2), "utf-8");
  } catch (error) {
    driftLogger.warn(
      `Failed to persist runtime drift history: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function parsePythonHealthTelemetry(payload: unknown): PythonRuntimeTelemetry {
  if (!isObject(payload)) {
    return {
      status: "unavailable",
      pid: null,
      uptimeSeconds: null,
      memoryRssMb: null,
      memoryLimitMb: null,
      memoryState: "unknown",
      error: "Invalid Python health payload",
    };
  }

  const payloadStatus = payload.status;
  const runtime = isObject(payload.runtime) ? payload.runtime : {};
  const memory = isObject(runtime.memory) ? runtime.memory : {};
  const memoryState = isRuntimeMemoryState(memory.state) ? memory.state : "unknown";
  const status: PythonRuntimeStatus =
    payloadStatus === "ok"
      ? "healthy"
      : payloadStatus === "degraded"
        ? "degraded"
        : "unavailable";

  return {
    status,
    pid: toOptionalNumber(runtime.pid),
    uptimeSeconds: toOptionalNumber(runtime.uptimeSeconds),
    memoryRssMb: toOptionalNumber(memory.rssMb),
    memoryLimitMb: toOptionalNumber(memory.limitMb),
    memoryState,
    error:
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.detail === "string"
          ? payload.detail
          : undefined,
  };
}

async function fetchPythonRuntimeTelemetry(): Promise<PythonRuntimeTelemetry> {
  const baseUrl =
    process.env.PYTHON_API_URL ||
    process.env.BRUNELLA_PYTHON_API_URL ||
    "http://127.0.0.1:8000";
  const normalizedBase = baseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${normalizedBase}/health`, {
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        pid: null,
        uptimeSeconds: null,
        memoryRssMb: null,
        memoryLimitMb: null,
        memoryState: "unknown",
        error: `HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as unknown;
    return parsePythonHealthTelemetry(payload);
  } catch (error) {
    return {
      status: "unavailable",
      pid: null,
      uptimeSeconds: null,
      memoryRssMb: null,
      memoryLimitMb: null,
      memoryState: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function didNodeRestart(
  previous: RuntimeDriftSample,
  current: RuntimeDriftSample,
): boolean {
  return (
    current.node.pid !== previous.node.pid ||
    current.node.uptimeSeconds + RESTART_UPTIME_TOLERANCE_SECONDS <
      previous.node.uptimeSeconds
  );
}

export function didPythonRestart(
  previous: RuntimeDriftSample,
  current: RuntimeDriftSample,
): boolean {
  if (
    previous.python.status === "unavailable" ||
    current.python.status === "unavailable"
  ) {
    return false;
  }

  const previousPid = previous.python.pid;
  const currentPid = current.python.pid;
  const previousUptime = previous.python.uptimeSeconds;
  const currentUptime = current.python.uptimeSeconds;

  return (
    (previousPid !== null && currentPid !== null && previousPid !== currentPid) ||
    (previousUptime !== null &&
      currentUptime !== null &&
      currentUptime + RESTART_UPTIME_TOLERANCE_SECONDS < previousUptime)
  );
}

export function buildRuntimeDriftSummary(
  samples: RuntimeDriftSample[],
): RuntimeDriftSummary {
  if (samples.length === 0) {
    return {
      overallState: "collecting",
      sampleCount: 0,
      windowMinutes: 0,
      lastSampleAt: null,
      recommendation: buildObservationRecommendation(
        null,
        "Meg nincs eleg runtime drift minta a stable tuning ajanlashoz.",
        "no_samples",
      ),
      node: {
        currentState: null,
        currentBudgetState: "none",
        currentHeapUtilizationPercent: null,
        maxHeapUtilizationPercent: null,
        maxHeapUsedMb: null,
        restartCount: 0,
        driftCount: 0,
      },
      python: {
        status: "unavailable",
        currentState: "unknown",
        currentMemoryRssMb: null,
        maxMemoryRssMb: null,
        restartCount: 0,
        unavailableCount: 0,
        pid: null,
      },
    };
  }

  const latest = samples[samples.length - 1];
  const first = samples[0];
  let nodeRestartCount = 0;
  let pythonRestartCount = 0;

  for (let index = 1; index < samples.length; index += 1) {
    if (didNodeRestart(samples[index - 1], samples[index])) {
      nodeRestartCount += 1;
    }
    if (didPythonRestart(samples[index - 1], samples[index])) {
      pythonRestartCount += 1;
    }
  }

  const nodeBudgetStates = samples
    .map((sample) => sample.node.budget?.state)
    .filter((state): state is RuntimeBudgetState => isRuntimeBudgetState(state));
  const driftCount = nodeBudgetStates.filter(
    (state) => state === "drift" || state === "invalid",
  ).length;
  const maxHeapUtilizationPercent = Math.max(
    ...samples.map((sample) => sample.node.memory.heapUtilizationPercent),
  );
  const maxHeapUsedMb = Math.max(
    ...samples.map((sample) => sample.node.memory.heapUsedMb),
  );
  const maxPythonMemoryRssMb =
    samples
      .map((sample) => sample.python.memoryRssMb)
      .filter((value): value is number => value !== null)
      .reduce<number | null>(
        (max, value) => (max === null || value > max ? value : max),
        null,
      ) ?? null;
  const unavailableCount = samples.filter(
    (sample) => sample.python.status === "unavailable",
  ).length;

  const currentBudgetState = latest.node.budget?.state ?? "none";
  const critical =
    latest.node.memory.state === "critical" ||
    currentBudgetState === "invalid" ||
    latest.python.memoryState === "critical" ||
    nodeRestartCount > 1 ||
    pythonRestartCount > 1;
  const warn =
    latest.node.memory.state === "warn" ||
    currentBudgetState === "drift" ||
    latest.python.status !== "healthy" ||
    latest.python.memoryState === "warn" ||
    nodeRestartCount > 0 ||
    pythonRestartCount > 0 ||
    unavailableCount > 0;
  const windowMinutes =
    samples.length > 1
      ? Math.round(
          ((Date.parse(latest.timestamp) - Date.parse(first.timestamp)) / 60_000) *
            10,
        ) / 10
      : 0;
  const recommendation = buildRuntimeTuningRecommendation({
    latest,
    sampleCount: samples.length,
    windowMinutes,
    nodeRestartCount,
    pythonRestartCount,
    maxHeapUtilizationPercent,
    maxHeapUsedMb,
    maxPythonMemoryRssMb,
    unavailableCount,
  });

  return {
    overallState: critical ? "critical" : warn ? "warn" : "healthy",
    sampleCount: samples.length,
    windowMinutes,
    lastSampleAt: latest.timestamp,
    recommendation,
    node: {
      currentState: latest.node.memory.state,
      currentBudgetState,
      currentHeapUtilizationPercent: latest.node.memory.heapUtilizationPercent,
      maxHeapUtilizationPercent,
      maxHeapUsedMb,
      restartCount: nodeRestartCount,
      driftCount,
    },
    python: {
      status: latest.python.status,
      currentState: latest.python.memoryState,
      currentMemoryRssMb: latest.python.memoryRssMb,
      maxMemoryRssMb: maxPythonMemoryRssMb,
      restartCount: pythonRestartCount,
      unavailableCount,
      pid: latest.python.pid,
      error: latest.python.error,
    },
  };
}

export function getRuntimeDriftSnapshot(limit?: number): RuntimeDriftSnapshot {
  loadHistoryOnce();
  const samples =
    limit !== undefined && Number.isFinite(limit) && limit > 0
      ? sampleHistory.slice(-Math.round(limit))
      : sampleHistory;

  return {
    summary: buildRuntimeDriftSummary(samples),
    samples,
  };
}

async function collectRuntimeDriftSample(): Promise<void> {
  loadHistoryOnce();
  const previous = sampleHistory[sampleHistory.length - 1];
  const sample: RuntimeDriftSample = {
    timestamp: new Date().toISOString(),
    node: getRuntimeTelemetry(),
    python: await fetchPythonRuntimeTelemetry(),
  };

  if (previous && didNodeRestart(previous, sample)) {
    driftLogger.warn(
      `Node runtime restart detected between ${previous.timestamp} and ${sample.timestamp}`,
    );
  }

  if (previous && didPythonRestart(previous, sample)) {
    driftLogger.warn(
      `Python runtime restart detected between ${previous.timestamp} and ${sample.timestamp}`,
    );
  }

  sampleHistory = trimSamples([...sampleHistory, sample]);
  persistHistory();
}

export async function startRuntimeDriftMonitor(): Promise<void> {
  if (monitorTimer) {
    return;
  }

  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    await collectRuntimeDriftSample();

    monitorTimer = setInterval(() => {
      void collectRuntimeDriftSample().catch((error) => {
        driftLogger.warn(
          `Runtime drift sample failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }, getSamplingIntervalMs());

    if (typeof monitorTimer.unref === "function") {
      monitorTimer.unref();
    }
  })();

  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
}

export function stopRuntimeDriftMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
