#!/usr/bin/env npx tsx
/**
 * BAS Health Check Script — Startup diagnózis
 *
 * Ellenőrzi a rendszer összes kritikus szolgáltatásának elérhetőségét:
 * - Ollama LLM (modellek betöltve?)
 * - Python FastAPI (bridge működik?)
 * - LanceDB (vektor DB elérhető?)
 * - API kulcsok érvényessége
 * - SQLite adatbázisok
 * - Build frissessége
 *
 * Futtatás: npm run test:health
 */

import fs from "node:fs";
import path from "node:path";
import {
  getBasCloudflareAccountId,
  getBasCloudflareApiToken,
  getPersonalCloudflareAccountId,
  getPersonalCloudflareApiToken,
} from "../src/utils/cloudflareConfig.js";

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  durationMs: number;
}

interface HealthReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "unhealthy";
  runtimeOverall: "healthy" | "degraded" | "unhealthy";
  checks: CheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
}

// ============================================================================
// Individual Checks
// ============================================================================

async function checkOllama(): Promise<CheckResult> {
  const start = Date.now();
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  try {
    const resp = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return {
        name: "Ollama",
        status: "fail",
        message: `HTTP ${resp.status}`,
        durationMs: Date.now() - start,
      };
    }
    const data = (await resp.json()) as { models?: Array<{ name: string }> };
    const modelCount = data.models?.length ?? 0;
    const hasLlama =
      data.models?.some((m) => m.name.includes("llama")) ?? false;
    if (modelCount === 0) {
      return {
        name: "Ollama",
        status: "warn",
        message: "Ollama fut, de nincs betöltött modell!",
        durationMs: Date.now() - start,
      };
    }
    return {
      name: "Ollama",
      status: "pass",
      message: `${modelCount} modell${hasLlama ? " (llama ✓)" : ""}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      name: "Ollama",
      status: "fail",
      message: `Nem elérhető: ${(e as Error).message}`,
      durationMs: Date.now() - start,
    };
  }
}

async function checkPython(): Promise<CheckResult> {
  const start = Date.now();
  // Prefer 127.0.0.1 over localhost to avoid IPv6/IPv4 resolution delay on Windows
  const pythonUrl = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
  try {
    const resp = await fetch(`${pythonUrl}/health`, {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { status?: string };
      return {
        name: "Python FastAPI",
        status: "pass",
        message: `Elérhető (${data.status || "ok"})`,
        durationMs: Date.now() - start,
      };
    }
    return {
      name: "Python FastAPI",
      status: "warn",
      message: `HTTP ${resp.status}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      name: "Python FastAPI",
      status: "warn",
      message: `Nem elérhető: ${(e as Error).message}`,
      durationMs: Date.now() - start,
    };
  }
}

async function checkCloudflare(): Promise<CheckResult> {
  const start = Date.now();
  const basToken = getBasCloudflareApiToken();
  const personalToken = getPersonalCloudflareApiToken();
  const basAccountId = getBasCloudflareAccountId();
  const personalAccountId = getPersonalCloudflareAccountId();
  const gatewayId = process.env.CF_GATEWAY_ID || "brunella-gateway";

  let aiStatus: "pass" | "fail" | "warn" = "warn";
  const tokenSummaries: string[] = [];

  async function verifyToken(name: string, token: string | undefined, accountId?: string): Promise<void> {
    if (!token) {
      tokenSummaries.push(`${name}: hiányzik`);
      return;
    }

    try {
      const verifyResp = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!verifyResp.ok) {
        tokenSummaries.push(`${name}: token HTTP ${verifyResp.status}`);
        aiStatus = "warn";
        return;
      }

      if (name === "BAS" && accountId) {
        const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
        const resp = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok || resp.status === 404 || resp.status === 400) {
          tokenSummaries.push(`${name}: token OK + AI Gateway OK`);
          aiStatus = "pass";
          return;
        }

        tokenSummaries.push(`${name}: token OK, AI Gateway HTTP ${resp.status}`);
        aiStatus = resp.status === 401 || resp.status === 403 ? "warn" : "fail";
        return;
      }

      tokenSummaries.push(`${name}: token OK${accountId ? " + account present" : ""}`);
      aiStatus = aiStatus === "fail" ? "fail" : "pass";
    } catch (e) {
      tokenSummaries.push(`${name}: ${(e as Error).message}`);
      aiStatus = "fail";
    }
  }

  await verifyToken("BAS", basToken, basAccountId);
  await verifyToken("Personal", personalToken, personalAccountId);

  const aiMessage = tokenSummaries.length > 0 ? tokenSummaries.join("; ") : "AI Gateway: Hiányzó konfig";

  // R2 Check
  let r2Status: "pass" | "fail" | "warn" = "warn";
  let r2Message: string;
  const r2Url =
    process.env.S3_API || `https://${basAccountId}.r2.cloudflarestorage.com`;

  if (accountId) {
    try {
      const resp = await fetch(r2Url, { signal: AbortSignal.timeout(5000) });
      // R2 usually returns 403 on root GET without auth, which is FINE (it exists)
      if (resp.status < 500) {
        r2Status = "pass";
        r2Message = "R2 OK";
      } else {
        r2Message = `R2 HTTP ${resp.status}`;
        r2Status = "fail";
      }
    } catch (e) {
      r2Message = `R2 error: ${(e as Error).message}`;
      r2Status = "fail";
    }
  } else {
    r2Message = "R2: Hiányzó account id";
  }

  const finalStatus =
    aiStatus === "pass" && r2Status === "pass"
      ? "pass"
      : aiStatus === "fail" || r2Status === "fail"
        ? "fail"
        : "warn";
  return {
    name: "Cloudflare",
    status: finalStatus,
    message: `${aiMessage} / ${r2Message}`,
    durationMs: Date.now() - start,
  };
}

async function checkNodeBackend(): Promise<CheckResult> {
  const start = Date.now();
  const port = process.env.PORT || "3000";
  try {
    const resp = await fetch(`http://localhost:${port}/readyz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        status?: string;
        ready?: boolean;
        runtime?: {
          memory?: {
            heapUsedMb?: number;
            heapLimitMb?: number;
            heapUtilizationPercent?: number;
            state?: "healthy" | "warn" | "critical";
          };
          budget?: {
            configuredHeapMb?: number | null;
            runtimeMemoryLimitMb?: number | null;
            restartThresholdMb?: number | null;
            effectiveHeapLimitMb?: number;
            state?: "aligned" | "drift" | "invalid" | "unconfigured";
          };
        };
      };
      const memory = data.runtime?.memory;
      const budget = data.runtime?.budget;
      const memorySummary = memory
        ? ` heap=${memory.heapUsedMb ?? "?"}/${memory.heapLimitMb ?? "?"}MB (${memory.heapUtilizationPercent ?? "?"}%)`
        : "";
      const budgetSummary = budget
        ? ` budget=${budget.configuredHeapMb ?? "?"}/${budget.runtimeMemoryLimitMb ?? "?"}MB restart=${budget.restartThresholdMb ?? "?"}MB actual=${budget.effectiveHeapLimitMb ?? "?"}MB contract=${budget.state ?? "?"}`
        : "";
      const memoryState = memory?.state;
      const budgetState = budget?.state;
      return {
        name: "Node.js Backend",
        status:
          data.ready === false ||
          memoryState === "warn" ||
          memoryState === "critical" ||
          budgetState === "drift" ||
          budgetState === "invalid"
            ? "warn"
            : "pass",
        message: `status=${data.status || "unknown"}${memorySummary}${budgetSummary}${memoryState ? ` [${memoryState}]` : ""}${budgetState ? ` [contract:${budgetState}]` : ""}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      name: "Node.js Backend",
      status: "fail",
      message: `HTTP ${resp.status}`,
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      name: "Node.js Backend",
      status: "warn",
      message: "Nem fut (normális, ha nincs elindítva)",
      durationMs: Date.now() - start,
    };
  }
}

function checkSecrets(): CheckResult {
  const start = Date.now();
  if (process.env.BRUNELLA_SKIP_SECRETS_CHECK === "1") {
    return {
      name: "API Kulcsok",
      status: "pass",
      message: "Ellenőrzés kihagyva (BRUNELLA_SKIP_SECRETS_CHECK=1)",
      durationMs: Date.now() - start,
    };
  }

  const criticalVars = [
    { name: "OLLAMA_BASE_URL", required: false },
    { name: "ANYTHINGLLM_API_KEY", required: false },
    { name: "GOOGLE_API_KEY", required: false },
    { name: "LANGCHAIN_API_KEY", required: false },
    { name: "CF_API_TOKEN", required: false },
    { name: "GITHUB_TOKEN", required: false },
  ];

  const missing: string[] = [];
  for (const v of criticalVars) {
    if (!process.env[v.name]) {
      missing.push(v.name);
    }
  }

  if (missing.length === 0) {
    return {
      name: "API Kulcsok",
      status: "pass",
      message: "Minden kulcs beállítva",
      durationMs: Date.now() - start,
    };
  }
  if (missing.length <= 2) {
    return {
      name: "API Kulcsok",
      status: "warn",
      message: `Hiányzik: ${missing.join(", ")}`,
      durationMs: Date.now() - start,
    };
  }
  return {
    name: "API Kulcsok",
    status: "warn",
    message: `${missing.length} kulcs hiányzik: ${missing.join(", ")}`,
    durationMs: Date.now() - start,
  };
}

function checkDatabases(): CheckResult {
  const start = Date.now();
  const dbFiles = [
    { path: "data/checkpoints.db", name: "Checkpoint DB" },
    { path: "data/audit.db", name: "Audit DB" },
    { path: "data/tasks.db", name: "Tasks DB" },
  ];

  const existing: string[] = [];
  const missing: string[] = [];

  for (const db of dbFiles) {
    const fullPath = path.join(process.cwd(), db.path);
    if (fs.existsSync(fullPath)) {
      existing.push(db.name);
    } else {
      missing.push(db.name);
    }
  }

  if (missing.length === 0) {
    return {
      name: "SQLite DBs",
      status: "pass",
      message: `${existing.length} DB elérhető`,
      durationMs: Date.now() - start,
    };
  }
  return {
    name: "SQLite DBs",
    status: "warn",
    message: `Hiányzik: ${missing.join(", ")} (első futásnál normális)`,
    durationMs: Date.now() - start,
  };
}

function checkBuildFreshness(): CheckResult {
  const start = Date.now();
  const buildIndex = path.join(process.cwd(), "build", "index.js");
  const srcIndex = path.join(process.cwd(), "src", "index.ts");

  if (!fs.existsSync(buildIndex)) {
    return {
      name: "Build",
      status: "fail",
      message: "build/index.js nem létezik! Futtasd: npm run build",
      durationMs: Date.now() - start,
    };
  }
  if (!fs.existsSync(srcIndex)) {
    return {
      name: "Build",
      status: "pass",
      message: "Build létezik",
      durationMs: Date.now() - start,
    };
  }

  const buildTime = fs.statSync(buildIndex).mtimeMs;
  const srcTime = fs.statSync(srcIndex).mtimeMs;

  if (srcTime > buildTime) {
    return {
      name: "Build",
      status: "warn",
      message: "Build elavult! src/ újabb mint build/. Futtasd: npm run build",
      durationMs: Date.now() - start,
    };
  }
  return {
    name: "Build",
    status: "pass",
    message: "Build friss",
    durationMs: Date.now() - start,
  };
}

function checkDiskSpace(): CheckResult {
  const start = Date.now();
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      return {
        name: "Lemezterület",
        status: "pass",
        message: "data/ mappa még nem létezik",
        durationMs: Date.now() - start,
      };
    }
    return {
      name: "Lemezterület",
      status: "pass",
      message: "OK",
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      name: "Lemezterület",
      status: "warn",
      message: "Nem sikerült ellenőrizni",
      durationMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Main
// ============================================================================

export async function runHealthCheck(): Promise<HealthReport> {
  const results = await Promise.allSettled([
    checkOllama(),
    checkPython(),
    checkCloudflare(),
    checkNodeBackend(),
    Promise.resolve(checkSecrets()),
    Promise.resolve(checkDatabases()),
    Promise.resolve(checkBuildFreshness()),
    Promise.resolve(checkDiskSpace()),
  ]);

  const checks: CheckResult[] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: "Unknown",
          status: "fail" as const,
          message: String((r as PromiseRejectedResult).reason),
          durationMs: 0,
        },
  );

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  let overall: "healthy" | "degraded" | "unhealthy";
  if (failCount > 0) overall = "unhealthy";
  else if (warnCount > 0) overall = "degraded";
  else overall = "healthy";

  const runtimeChecks = checks.filter((check) =>
    ["Node.js Backend", "Python FastAPI", "Build", "SQLite DBs"].includes(check.name),
  );
  const runtimeFailCount = runtimeChecks.filter((check) => check.status === "fail").length;
  const runtimeWarnCount = runtimeChecks.filter((check) => check.status === "warn").length;

  let runtimeOverall: "healthy" | "degraded" | "unhealthy";
  if (runtimeFailCount > 0) runtimeOverall = "unhealthy";
  else if (runtimeWarnCount > 0) runtimeOverall = "degraded";
  else runtimeOverall = "healthy";

  return {
    timestamp: new Date().toISOString(),
    overall,
    runtimeOverall,
    checks,
    passCount,
    warnCount,
    failCount,
  };
}

// ============================================================================
// CLI output
// ============================================================================

const ICONS = { pass: "✅", warn: "⚠️", fail: "❌" };

function printReport(report: HealthReport): void {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║        🏥 BAS RENDSZER DIAGNOSZTIKA              ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  for (const check of report.checks) {
    const icon = ICONS[check.status];
    const duration = check.durationMs > 0 ? ` (${check.durationMs}ms)` : "";
    console.log(
      `  ${icon} ${check.name.padEnd(20)} ${check.message}${duration}`,
    );
  }

  console.log("\n──────────────────────────────────────────────────");
  const overallIcon =
    report.overall === "healthy"
      ? "🟢"
      : report.overall === "degraded"
        ? "🟡"
        : "🔴";
  console.log(
    `  ${overallIcon} Összesítés: ${report.passCount} PASS, ${report.warnCount} WARN, ${report.failCount} FAIL`,
  );
  console.log(`  📊 Állapot: ${report.overall.toUpperCase()}`);
  console.log(`  ⚙️ Runtime: ${report.runtimeOverall.toUpperCase()}`);
  console.log(`  🕐 ${report.timestamp}\n`);
}

// Direct execution
const isDirectRun = process.argv[1]?.includes("health_check");
if (isDirectRun) {
  // Load .env if dotenv available
  try {
    await import("dotenv/config");
  } catch {
    /* no dotenv, that's fine */
  }
  const report = await runHealthCheck();
  printReport(report);
  process.exitCode = report.overall === "unhealthy" ? 1 : 0;
}
