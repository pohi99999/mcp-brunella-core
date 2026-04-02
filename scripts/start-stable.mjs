import { existsSync } from "fs";
import { getHeapStatistics } from "node:v8";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const DEFAULT_NODE_HEAP_MB = 1536;
const DEFAULT_RUNTIME_MEMORY_LIMIT_MB = 2048;
const HEAP_DRIFT_TOLERANCE_MB = 256;

function toMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function parseBudgetEnv(name, rawValue, fallback) {
  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `[brunella:start-stable] Invalid ${name}="${rawValue}". Expected a positive number in MB.`,
    );
  }

  return Math.round(parsed);
}

export function resolveRuntimeContract(env = process.env) {
  const configuredHeapMb = parseBudgetEnv(
    "BRUNELLA_NODE_MAX_OLD_SPACE_SIZE",
    env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE,
    DEFAULT_NODE_HEAP_MB,
  );
  const runtimeMemoryLimitMb = parseBudgetEnv(
    "BRUNELLA_RUNTIME_MEMORY_LIMIT_MB",
    env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB,
    Math.max(DEFAULT_RUNTIME_MEMORY_LIMIT_MB, configuredHeapMb + 512),
  );
  const restartThresholdMb = parseBudgetEnv(
    "BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB",
    env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB,
    Math.min(runtimeMemoryLimitMb - 128, configuredHeapMb + 256),
  );
  const source =
    env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE ||
    env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB ||
    env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB
      ? "env"
      : "default";

  return {
    configuredHeapMb,
    runtimeMemoryLimitMb,
    restartThresholdMb,
    source,
  };
}

export function validateRuntimeBudgetConfiguration(contract) {
  if (contract.runtimeMemoryLimitMb <= contract.configuredHeapMb) {
    throw new Error(
      `[brunella:start-stable] Invalid runtime contract: runtime limit ${contract.runtimeMemoryLimitMb}MB must be greater than heap budget ${contract.configuredHeapMb}MB.`,
    );
  }

  if (contract.restartThresholdMb <= contract.configuredHeapMb) {
    throw new Error(
      `[brunella:start-stable] Invalid runtime contract: restart threshold ${contract.restartThresholdMb}MB must be greater than heap budget ${contract.configuredHeapMb}MB.`,
    );
  }

  if (contract.restartThresholdMb >= contract.runtimeMemoryLimitMb) {
    throw new Error(
      `[brunella:start-stable] Invalid runtime contract: restart threshold ${contract.restartThresholdMb}MB must stay below runtime limit ${contract.runtimeMemoryLimitMb}MB.`,
    );
  }
}

export function validateRuntimeContract(contract, observedHeapLimitMb) {
  validateRuntimeBudgetConfiguration(contract);

  const heapDriftMb = Math.round((observedHeapLimitMb - contract.configuredHeapMb) * 10) / 10;
  if (Math.abs(heapDriftMb) > HEAP_DRIFT_TOLERANCE_MB) {
    throw new Error(
      `[brunella:start-stable] Runtime heap drift detected. Expected launcher heap budget ${contract.configuredHeapMb}MB, observed V8 heap limit ${observedHeapLimitMb}MB. Start this process with --max-old-space-size=${contract.configuredHeapMb}.`,
    );
  }

  return heapDriftMb;
}

function applyContractEnv(contract, observedHeapLimitMb, heapDriftMb) {
  process.env.BRUNELLA_RUNTIME_CONTRACT_ENABLED = "1";
  process.env.BRUNELLA_RUNTIME_CONTRACT_SOURCE = contract.source;
  process.env.BRUNELLA_RUNTIME_CONTRACT_STATE = "aligned";
  process.env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE = String(contract.configuredHeapMb);
  process.env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB = String(contract.runtimeMemoryLimitMb);
  process.env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB = String(contract.restartThresholdMb);
  process.env.BRUNELLA_RUNTIME_EFFECTIVE_HEAP_LIMIT_MB = String(observedHeapLimitMb);
  process.env.BRUNELLA_RUNTIME_HEAP_DRIFT_MB = String(heapDriftMb);
}

export async function startStable() {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }

  if (!process.env.WEB_UI_ENABLED) {
    process.env.WEB_UI_ENABLED = "true";
  }

  if (!process.env.BRUNELLA_WORKSPACE_ROOT) {
    process.env.BRUNELLA_WORKSPACE_ROOT = process.cwd();
  }

  const contract = resolveRuntimeContract(process.env);
  const observedHeapLimitMb = toMb(getHeapStatistics().heap_size_limit);
  const heapDriftMb = validateRuntimeContract(contract, observedHeapLimitMb);
  applyContractEnv(contract, observedHeapLimitMb, heapDriftMb);

  const entryPoint = path.resolve(process.cwd(), "build", "index.js");
  if (!existsSync(entryPoint)) {
    throw new Error(
      `[brunella:start-stable] Missing build artifact: ${entryPoint}. Run "npm run build:stable" first.`,
    );
  }

  const uiEntryPoint = path.resolve(process.cwd(), "build", "public", "index.html");
  const webUiEnabled =
    process.env.WEB_UI_ENABLED !== "0" &&
    process.env.WEB_UI_ENABLED !== "false";
  if (process.env.NODE_ENV === "production" && webUiEnabled && !existsSync(uiEntryPoint)) {
    throw new Error(
      `[brunella:start-stable] Missing built dashboard asset: ${uiEntryPoint}. Run "npm run build:stable" first.`,
    );
  }

  await import(pathToFileURL(entryPoint).href);
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await startStable();
}
