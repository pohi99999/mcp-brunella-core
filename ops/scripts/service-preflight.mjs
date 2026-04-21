import { accessSync, constants as fsConstants, existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import {
  resolveRuntimeContract,
  validateRuntimeBudgetConfiguration,
} from "./start-stable.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function getPathApi(platform) {
  return platform === "windows" ? path.win32 : path.posix;
}

function getDefaultPlatform() {
  return process.platform === "win32" ? "windows" : "linux";
}

export function parsePlatformArg(argv = process.argv.slice(2)) {
  const platformFlagIndex = argv.indexOf("--platform");
  if (platformFlagIndex >= 0 && argv[platformFlagIndex + 1]) {
    const explicitPlatform = argv[platformFlagIndex + 1].toLowerCase();
    if (explicitPlatform === "windows" || explicitPlatform === "linux") {
      return explicitPlatform;
    }
    throw new Error(
      `[brunella:service-preflight] Unsupported platform "${argv[platformFlagIndex + 1]}". Use "windows" or "linux".`,
    );
  }

  return getDefaultPlatform();
}

export function getPythonRuntimeCandidates(platform, repoRoot) {
  const pathApi = getPathApi(platform);
  if (platform === "windows") {
    return {
      paths: [
        pathApi.join(repoRoot, "myai", ".venv", "Scripts", "python.exe"),
        pathApi.join(repoRoot, ".venv", "Scripts", "python.exe"),
        pathApi.join(repoRoot, "mcp_env", "Scripts", "python.exe"),
      ],
      commands: ["uv", "python.exe"],
    };
  }

  return {
    paths: [
      pathApi.join(repoRoot, "myai", ".venv", "bin", "python"),
      pathApi.join(repoRoot, ".venv", "bin", "python"),
      pathApi.join(repoRoot, "mcp_env", "bin", "python"),
    ],
    commands: ["uv", "python3", "python"],
  };
}

function defaultCommandExists(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function ensureWritableDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
  accessSync(directoryPath, fsConstants.W_OK);
}

export function buildServicePreflightReport({
  platform,
  repoRoot = DEFAULT_REPO_ROOT,
  env = process.env,
  pathExists = existsSync,
  commandExists = defaultCommandExists,
  ensureWritableDir = ensureWritableDirectory,
} = {}) {
  const resolvedPlatform = platform ?? getDefaultPlatform();
  const pathApi = getPathApi(resolvedPlatform);
  const checks = [];

  checks.push({
    name: "Node runtime",
    status: "pass",
    message: `Detected ${process.version}`,
  });

  try {
    const contract = resolveRuntimeContract(env);
    validateRuntimeBudgetConfiguration(contract);
    checks.push({
      name: "Runtime contract",
      status: "pass",
      message: `heap=${contract.configuredHeapMb}MB limit=${contract.runtimeMemoryLimitMb}MB restart=${contract.restartThresholdMb}MB (${contract.source})`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "Runtime contract",
      status: "fail",
      message,
    });
  }

  const requiredPaths = [
    {
      name: "Stable build",
      filePath: pathApi.join(repoRoot, "build", "index.js"),
      guidance: 'Run "npm run build:stable" first.',
    },
    {
      name: "Dashboard build",
      filePath: pathApi.join(repoRoot, "build", "public", "index.html"),
      guidance: 'Run "npm run build:stable" first.',
    },
    {
      name: "Python app",
      filePath: pathApi.join(repoRoot, "myai", "server.py"),
      guidance: "Python runtime sources are missing.",
    },
  ];

  const runnerPaths =
    resolvedPlatform === "windows"
      ? [
          pathApi.join(repoRoot, "scripts", "supervisors", "windows", "run-brunella-core.ps1"),
          pathApi.join(repoRoot, "scripts", "supervisors", "windows", "run-brunella-python.ps1"),
        ]
      : [
          pathApi.join(repoRoot, "scripts", "supervisors", "linux", "run-brunella-core.sh"),
          pathApi.join(repoRoot, "scripts", "supervisors", "linux", "run-brunella-python.sh"),
        ];

  for (const requiredPath of requiredPaths) {
    const exists = pathExists(requiredPath.filePath);
    checks.push({
      name: requiredPath.name,
      status: exists ? "pass" : "fail",
      message: exists
        ? pathApi.relative(repoRoot, requiredPath.filePath)
        : `${pathApi.relative(repoRoot, requiredPath.filePath)} missing. ${requiredPath.guidance}`,
    });
  }

  for (const runnerPath of runnerPaths) {
    const exists = pathExists(runnerPath);
    checks.push({
      name: `Runner ${path.basename(runnerPath)}`,
      status: exists ? "pass" : "fail",
      message: exists
        ? pathApi.relative(repoRoot, runnerPath)
        : `${pathApi.relative(repoRoot, runnerPath)} missing.`,
    });
  }

  for (const relativeDirectory of ["data", "logs"]) {
    const directoryPath = pathApi.join(repoRoot, relativeDirectory);
    try {
      ensureWritableDir(directoryPath);
      checks.push({
        name: `${relativeDirectory} writable`,
        status: "pass",
        message: pathApi.relative(repoRoot, directoryPath) || relativeDirectory,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: `${relativeDirectory} writable`,
        status: "fail",
        message,
      });
    }
  }

  const pythonCandidates = getPythonRuntimeCandidates(resolvedPlatform, repoRoot);
  const pythonPathCandidate = pythonCandidates.paths.find((candidate) => pathExists(candidate));
  const pythonCommandCandidate =
    pythonPathCandidate === undefined
      ? pythonCandidates.commands.find((command) => commandExists(command))
      : undefined;

  if (pythonPathCandidate || pythonCommandCandidate) {
    checks.push({
      name: "Python runtime",
      status: "pass",
      message: pythonPathCandidate
        ? pathApi.relative(repoRoot, pythonPathCandidate)
        : `${pythonCommandCandidate} from PATH`,
    });
  } else {
    checks.push({
      name: "Python runtime",
      status: "fail",
      message:
        "No Python runtime detected for Brunella. Create the expected virtualenv or install uv/python in PATH.",
    });
  }

  return {
    ok: checks.every((check) => check.status === "pass"),
    platform: resolvedPlatform,
    checks,
  };
}

export function formatServicePreflightReport(report) {
  const lines = [`Brunella service preflight (${report.platform})`, ""];

  for (const check of report.checks) {
    const icon = check.status === "pass" ? "[OK]" : "[FAIL]";
    lines.push(`${icon} ${check.name}: ${check.message}`);
  }

  lines.push("");
  lines.push(report.ok ? "[READY] Service install preflight passed." : "[BLOCKED] Service install preflight failed.");
  return lines.join("\n");
}

export function runServicePreflight(options = {}) {
  const report = buildServicePreflightReport(options);
  process.stdout.write(`${formatServicePreflightReport(report)}\n`);

  if (!report.ok) {
    throw new Error("[brunella:service-preflight] Fix the failed checks before installing services.");
  }

  return report;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const platform = parsePlatformArg(process.argv.slice(2));
  runServicePreflight({ platform });
}
