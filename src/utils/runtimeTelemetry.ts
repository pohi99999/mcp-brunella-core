import { getHeapStatistics } from "node:v8";

export type RuntimeMemoryState = "healthy" | "warn" | "critical";
export type RuntimeBudgetState = "aligned" | "drift" | "invalid" | "unconfigured";

export interface RuntimeMemoryTelemetry {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  heapLimitMb: number;
  heapUtilizationPercent: number;
  state: RuntimeMemoryState;
}

export interface RuntimeBudgetTelemetry {
  configuredHeapMb: number | null;
  runtimeMemoryLimitMb: number | null;
  restartThresholdMb: number | null;
  effectiveHeapLimitMb: number;
  heapDriftMb: number | null;
  headroomMb: number | null;
  source: string | null;
  state: RuntimeBudgetState;
}

export interface RuntimeTelemetry {
  pid: number;
  uptimeSeconds: number;
  memory: RuntimeMemoryTelemetry;
  budget?: RuntimeBudgetTelemetry;
}

const DEFAULT_WARN_RATIO = 0.75;
const DEFAULT_CRITICAL_RATIO = 0.9;
const HEAP_DRIFT_TOLERANCE_MB = 256;

function toMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function getThreshold(envName: string, fallback: number): number {
  const value = Number(process.env[envName]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOptionalMb(envName: string): number | null {
  const rawValue = process.env[envName];
  if (rawValue === undefined || rawValue === "") {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function getRuntimeBudgetTelemetry(heapLimitMb: number): RuntimeBudgetTelemetry | undefined {
  const contractEnabled =
    process.env.BRUNELLA_RUNTIME_CONTRACT_ENABLED === "1" ||
    process.env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE !== undefined ||
    process.env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB !== undefined ||
    process.env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB !== undefined;

  if (!contractEnabled) {
    return undefined;
  }

  const configuredHeapMb = getOptionalMb("BRUNELLA_NODE_MAX_OLD_SPACE_SIZE");
  const runtimeMemoryLimitMb = getOptionalMb("BRUNELLA_RUNTIME_MEMORY_LIMIT_MB");
  const restartThresholdMb = getOptionalMb("BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB");
  const effectiveHeapLimitMb =
    getOptionalMb("BRUNELLA_RUNTIME_EFFECTIVE_HEAP_LIMIT_MB") ?? heapLimitMb;
  const heapDriftMb =
    getOptionalMb("BRUNELLA_RUNTIME_HEAP_DRIFT_MB") ??
    (configuredHeapMb !== null
      ? Math.round((effectiveHeapLimitMb - configuredHeapMb) * 10) / 10
      : null);
  const headroomMb =
    configuredHeapMb !== null && runtimeMemoryLimitMb !== null
      ? runtimeMemoryLimitMb - configuredHeapMb
      : null;
  const configuredState = process.env.BRUNELLA_RUNTIME_CONTRACT_STATE;

  const state: RuntimeBudgetState =
    configuredState === "aligned" ||
    configuredState === "drift" ||
    configuredState === "invalid" ||
    configuredState === "unconfigured"
      ? configuredState
      : configuredHeapMb === null
        ? "unconfigured"
        : (
              (runtimeMemoryLimitMb !== null && configuredHeapMb >= runtimeMemoryLimitMb) ||
              (restartThresholdMb !== null && restartThresholdMb <= configuredHeapMb) ||
              (
                runtimeMemoryLimitMb !== null &&
                restartThresholdMb !== null &&
                restartThresholdMb >= runtimeMemoryLimitMb
              )
            )
          ? "invalid"
          : heapDriftMb !== null && Math.abs(heapDriftMb) > HEAP_DRIFT_TOLERANCE_MB
            ? "drift"
            : "aligned";

  return {
    configuredHeapMb,
    runtimeMemoryLimitMb,
    restartThresholdMb,
    effectiveHeapLimitMb,
    heapDriftMb,
    headroomMb,
    source: process.env.BRUNELLA_RUNTIME_CONTRACT_SOURCE ?? null,
    state,
  };
}

export function getRuntimeTelemetry(): RuntimeTelemetry {
  const memoryUsage = process.memoryUsage();
  const heapLimitBytes = getHeapStatistics().heap_size_limit;
  const warnRatio = getThreshold("BRUNELLA_HEAP_WARN_RATIO", DEFAULT_WARN_RATIO);
  const criticalRatio = getThreshold(
    "BRUNELLA_HEAP_CRITICAL_RATIO",
    DEFAULT_CRITICAL_RATIO,
  );
  const heapUtilization =
    heapLimitBytes > 0 ? memoryUsage.heapUsed / heapLimitBytes : 0;

  let state: RuntimeMemoryState = "healthy";
  if (heapUtilization >= criticalRatio) {
    state = "critical";
  } else if (heapUtilization >= warnRatio) {
    state = "warn";
  }

  return {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: toMb(memoryUsage.rss),
      heapTotalMb: toMb(memoryUsage.heapTotal),
      heapUsedMb: toMb(memoryUsage.heapUsed),
      externalMb: toMb(memoryUsage.external),
      arrayBuffersMb: toMb(memoryUsage.arrayBuffers),
      heapLimitMb: toMb(heapLimitBytes),
      heapUtilizationPercent: Math.round(heapUtilization * 1000) / 10,
      state,
    },
    budget: getRuntimeBudgetTelemetry(toMb(heapLimitBytes)),
  };
}
