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
// ============================================================================
// Individual Checks
// ============================================================================
async function checkOllama() {
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
        const data = (await resp.json());
        const modelCount = data.models?.length ?? 0;
        const hasLlama = data.models?.some((m) => m.name.includes("llama")) ?? false;
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
    }
    catch (e) {
        return {
            name: "Ollama",
            status: "fail",
            message: `Nem elérhető: ${e.message}`,
            durationMs: Date.now() - start,
        };
    }
}
async function checkPython() {
    const start = Date.now();
    // Prefer 127.0.0.1 over localhost to avoid IPv6/IPv4 resolution delay on Windows
    const pythonUrl = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
    try {
        const resp = await fetch(`${pythonUrl}/health`, {
            signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
            const data = (await resp.json());
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
    }
    catch (e) {
        return {
            name: "Python FastAPI",
            status: "warn",
            message: `Nem elérhető: ${e.message}`,
            durationMs: Date.now() - start,
        };
    }
}
async function checkCloudflare() {
    const start = Date.now();
    const tokens = [
        { name: "CF_API_TOKEN", val: process.env.CF_API_TOKEN },
        { name: "CF_TOKEN", val: process.env.CF_TOKEN },
        { name: "CLOUDFLARE_API_TOKEN", val: process.env.CLOUDFLARE_API_TOKEN },
    ].filter((t) => !!t.val);
    const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const gatewayId = process.env.CF_GATEWAY_ID || "brunella-gateway";
    let aiStatus = "warn";
    let aiMessage = "Offline";
    if (tokens.length > 0 && accountId) {
        for (const tokenObj of tokens) {
            try {
                const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
                const resp = await fetch(url, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${tokenObj.val}` },
                    signal: AbortSignal.timeout(5000),
                });
                if (resp.ok || resp.status === 404) {
                    aiStatus = "pass";
                    aiMessage = `AI Gateway OK (${tokenObj.name})`;
                    break;
                }
                aiMessage = `AI Gateway HTTP ${resp.status} (${tokenObj.name})`;
                if (resp.status === 401 || resp.status === 403)
                    aiStatus = "fail";
            }
            catch (e) {
                aiMessage = `AI Gateway: ${e.message}`;
                aiStatus = "fail";
            }
        }
    }
    else {
        aiMessage = "AI Gateway: Hiányzó konfig";
    }
    // R2 Check
    let r2Status = "warn";
    let r2Message = "";
    const r2Url = process.env.S3_API || `https://${accountId}.r2.cloudflarestorage.com`;
    if (accountId) {
        try {
            const resp = await fetch(r2Url, { signal: AbortSignal.timeout(5000) });
            // R2 usually returns 403 on root GET without auth, which is FINE (it exists)
            if (resp.status < 500) {
                r2Status = "pass";
                r2Message = "R2 OK";
            }
            else {
                r2Message = `R2 HTTP ${resp.status}`;
                r2Status = "fail";
            }
        }
        catch (e) {
            r2Message = `R2 error: ${e.message}`;
            r2Status = "fail";
        }
    }
    else {
        r2Message = "R2: Hiányzó account id";
    }
    const finalStatus = aiStatus === "pass" && r2Status === "pass"
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
async function checkNodeBackend() {
    const start = Date.now();
    const port = process.env.PORT || "3000";
    try {
        const resp = await fetch(`http://localhost:${port}/api/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
            const data = (await resp.json());
            return {
                name: "Node.js Backend",
                status: "pass",
                message: `status=${data.status}`,
                durationMs: Date.now() - start,
            };
        }
        return {
            name: "Node.js Backend",
            status: "fail",
            message: `HTTP ${resp.status}`,
            durationMs: Date.now() - start,
        };
    }
    catch {
        return {
            name: "Node.js Backend",
            status: "warn",
            message: "Nem fut (normális, ha nincs elindítva)",
            durationMs: Date.now() - start,
        };
    }
}
function checkSecrets() {
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
    const missing = [];
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
function checkDatabases() {
    const start = Date.now();
    const dbFiles = [
        { path: "data/checkpoint.db", name: "Checkpoint DB" },
        { path: "data/audit.db", name: "Audit DB" },
        { path: "data/tasks.db", name: "Tasks DB" },
    ];
    const existing = [];
    const missing = [];
    for (const db of dbFiles) {
        const fullPath = path.join(process.cwd(), db.path);
        if (fs.existsSync(fullPath)) {
            existing.push(db.name);
        }
        else {
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
function checkBuildFreshness() {
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
function checkDiskSpace() {
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
    }
    catch {
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
export async function runHealthCheck() {
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
    const checks = results.map((r) => r.status === "fulfilled"
        ? r.value
        : {
            name: "Unknown",
            status: "fail",
            message: String(r.reason),
            durationMs: 0,
        });
    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const failCount = checks.filter((c) => c.status === "fail").length;
    let overall;
    if (failCount > 0)
        overall = "unhealthy";
    else if (warnCount > 0)
        overall = "degraded";
    else
        overall = "healthy";
    return {
        timestamp: new Date().toISOString(),
        overall,
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
function printReport(report) {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║        🏥 BAS RENDSZER DIAGNOSZTIKA              ║");
    console.log("╚══════════════════════════════════════════════════╝\n");
    for (const check of report.checks) {
        const icon = ICONS[check.status];
        const duration = check.durationMs > 0 ? ` (${check.durationMs}ms)` : "";
        console.log(`  ${icon} ${check.name.padEnd(20)} ${check.message}${duration}`);
    }
    console.log("\n──────────────────────────────────────────────────");
    const overallIcon = report.overall === "healthy"
        ? "🟢"
        : report.overall === "degraded"
            ? "🟡"
            : "🔴";
    console.log(`  ${overallIcon} Összesítés: ${report.passCount} PASS, ${report.warnCount} WARN, ${report.failCount} FAIL`);
    console.log(`  📊 Állapot: ${report.overall.toUpperCase()}`);
    console.log(`  🕐 ${report.timestamp}\n`);
}
// Direct execution
const isDirectRun = process.argv[1]?.includes("health_check");
if (isDirectRun) {
    // Load .env if dotenv available
    try {
        await import("dotenv/config");
    }
    catch {
        /* no dotenv, that's fine */
    }
    const report = await runHealthCheck();
    printReport(report);
    process.exitCode = report.overall === "unhealthy" ? 1 : 0;
}
