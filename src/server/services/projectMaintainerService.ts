/**
 * @fileoverview Project Maintainer Service — repository maintenance scan.
 *
 * Performs an audit of the repository root, artefact files and
 * conductor tracks. Results are persisted to the `project_maintainer_reports`
 * SQLite table and returned as a structured `ProjectMaintainerReport`.
 *
 * This service provides both non-destructive reporting and active archival
 * of identified noise artefacts.
 */

import { randomUUID } from 'crypto';
import { existsSync, readdirSync, statSync, mkdirSync, renameSync } from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logDebug, logError, logInfo, logWarn } from '../../utils/logger.js';
import { ensureError } from '../../utils/ensureError.js';

// ── Public types ──────────────────────────────────────────────────────────────

/** Severity level of a single finding */
export type FindingSeverity = 'high' | 'medium' | 'low' | 'info';

/** A single maintenance finding */
export interface ProjectMaintainerFinding {
  category: 'root-noise' | 'misplaced-file' | 'track-anomaly' | 'structure-drift';
  severity: FindingSeverity;
  message: string;
  path?: string;
}

/** An actionable suggestion derived from findings */
export interface ProjectMaintainerSuggestion {
  action: 'review' | 'create';
  target: string;
  reason: string;
}

/** Summary stats for conductor tracks */
export interface TrackSummary {
  total: number;
  missingSpec: string[];
  missingPlan: string[];
  healthy: number;
}

/** Full output of one Project Maintainer run */
export interface ProjectMaintainerReport {
  id: string;
  generatedAt: string;
  triggeredBy: string;
  findings: ProjectMaintainerFinding[];
  suggestions: ProjectMaintainerSuggestion[];
  trackSummary: TrackSummary;
  dryRun: boolean;
}

/**
 * Ensures the Project Maintainer report table exists.
 * @param db - SQLite database instance
 */
export function initProjectMaintainerSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_maintainer_reports (
      id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      findings_count INTEGER DEFAULT 0,
      suggestions_count INTEGER DEFAULT 0,
      report_json TEXT NOT NULL,
      triggered_by TEXT DEFAULT 'scheduler',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pm_reports_generated_at
      ON project_maintainer_reports(generated_at);
  `);
}

// ── Constants ────────────────────────────────────────────────────────────────

const MODULE = 'ProjectMaintainerService';

/** Root-level files that are expected and should NOT be reported as noise */
const ROOT_ALLOWLIST = new Set<string>([
  '.copilotignore',
  '.dockerignore',
  '.env',
  '.env.example',
  '.eslintignore',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  'AGENTS.md',
  'AIDER.md',
  'BEVETEL_AKCIO.md',
  'BOOTSTRAP.md',
  'BOVITMENY.md',
  'BRUNELLA_MASTER_CONTEXT.md',
  'BRUNELLA_START.bat',
  'CHANGELOG.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'Dockerfile.node',
  'Dockerfile.p-sales-standalone',
  'Dockerfile.p-sales-standalone.dockerignore',
  'Dockerfile.python',
  'GEMINI.md',
  'HANDOFF.md',
  'Inditsd_Brunellat.bat',
  'Inditsd_Brunellat_Stabil.bat',
  'LICENSE',
  'MEGALLAPITAS.md',
  'PROJEKT_DIAGRAM.md',
  'README.md',
  'RENDSZER_DIAGRAM.md',
  'SECURITY.md',
  'TEST_RESULTS.md',
  'Toolskeszlet.md',
  'USER_START.md',
  '__workflows_api.json',
  'aranyfolyam.md',
  'cloudflare.md',
  'cloudflareversup.md',
  'cypress.config.ts',
  'docker-compose.prod.yml',
  'docker-compose.yml',
  'ecosystem.config.cjs',
  'eslint.config.js',
  'fastmcp.json',
  'funkcio.md',
  'github-sync.bat',
  'inditas.bat',
  'konyvtarfa.md',
  'litellm_config.yaml',
  'mcp-brunella-core.code-workspace',
  'mcp-brunella-core.sln',
  'mcp_servers.json',
  'n8n-workflows-list.md',
  'nginx.p-sales.conf',
  'package-lock.json',
  'package.json',
  'paios.config.yaml',
  'plan.md',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  'pyproject.toml',
  'requirements.txt',
  'skills-lock.json',
  'start-all.bat',
  'start-full-robust.bat',
  'start-full-system.bat',
  'start-full.bat',
  'start-vscode-web.bat',
  'start-with-copilot.bat',
  'start.bat',
  'tailwind.config.js',
  'task_complete.ps1',
  'tsconfig.json',
  'tsconfig.ui.json',
  'uv.lock',
  'vite.config.ts',
  'vite.overlay.config.ts',
  'vite.p-sales.config.ts',
  'vitest.config.ts',
  'vitest.dashboard.config.ts',
  'vitest.ui.config.ts',
  'after-click.md',
  'after_signin.txt',
  'dashboard-snapshot.md',
  'Brunella.jpg',
  'Brunella.md',
  'BRUNELLA_IDENTITY.md',
]);

/** File-name patterns at root that are known temp/debug artefacts */
const NOISE_PATTERNS: RegExp[] = [
  /^r\d+\.txt$/,                    // r1.txt … r13.txt
  /^content\d*.*\.txt$/,            // content2.txt, content_active_trigger.txt …
  /^debug.*\.txt$/i,                // debug1893.txt, debug_view.txt …
  /^.*-output\.txt$/,               // build-output.txt, test-output.txt …
  /^.*-log\.txt$/,                  // build-log.txt
  /^.*-result\.txt$/,               // build-result.txt
  /^.*-errors\.txt$/,               // build-errors.txt
  /^.*-out\d*\.txt$/,               // test-out4.txt
  /^cmd\d+-.*\.txt$/,               // cmd1-status.txt
  /^cred\d+.*\.txt$/,               // cred4_s2.txt
  /^exec\d+\.txt$/,                 // exec1893.txt
  /^wf\d+.*\.txt$/,                 // wf06_exec.txt
  /^state.*\.txt$/,                 // state_now.txt
  /^.*\.log$/,                      // any .log file at root
  /^diag-.*$/,                      // diag-localhost, diag-stderr.txt …
  /^tsc-.*\.txt$/,                  // tsc-errors.txt
  /^npm-test.*\.log$/,              // npm-test-failures-extract.log
  /^rerun_test.*\.log$/,            // rerun_test_dashboard.log
  /^node-server.*\.log$/,           // node-server.log, node-server-err.log
  /^vite-.*\.log$/,                 // vite-err.log, vite-server.log
  /^fastapi-server\.log$/,
  /^server_output\.log$/,
  /^test-fast.*\.txt$/,             // test-fast-clean.txt …
  /^eslint_report\.json$/,
  /^audit-results\.json$/,
  /^test-json-results\.json$/,
  /^test-results-latest\.json$/,
  /^test-results\d*\.txt$/,
  /^agent-health-output\.json$/,
  /^git-log-out\d*\.txt$/,
  /^git-push-out\.txt$/,
  /^build-audit\.txt$/,
  /^npm-test\d*\.log$/,
  /^vitest-rerun.*\.txt$/,
];

/** Expected top-level directories */
const EXPECTED_TOP_DIRS = new Set<string>([
  '.git',
  '.github',
  '.vscode',
  'ADR',
  'AnythingLLM',
  'Brunella',
  'Ollama',
  '_KNOWLEDGE_BASE',
  '__pycache__',
  '_archive',
  '_br_temp',
  'agentic-workflow',
  'archive',
  'bas-cloudflare-orchestrator',
  'bin',
  'browser-inspect',
  'build',
  'cloudflare',
  'conductor',
  'config',
  'coverage',
  'credentials',
  'data',
  'docs',
  'exceptions',
  'files',
  'logs',
  'mappings',
  'mcp-brunella-core',
  'myai',
  'n8n',
  'n8n-mcp-server',
  'n8nv2',
  'node_modules',
  'open-interpreter',
  'out',
  'playwright-report',
  'public',
  'schemas',
  'scripts',
  'skills',
  'src',
  'src-tauri',
  'tasks',
  'temp',
  'test',
  'test-results',
  'testing',
  'website_sources',
  'windows_bridge',
  'worker',
  'workers',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function repoRoot(): string {
  return path.resolve(process.cwd());
}

function isNoiseFile(name: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Moves identified noise files from root to logs/archive.
 * @param root - The repo root path
 * @param findings - All categorized findings
 * @returns Number of files moved
 */
function archiveNoiseFiles(root: string, findings: ProjectMaintainerFinding[]): number {
  const archivePath = path.join(root, 'logs', 'archive');
  if (!existsSync(archivePath)) {
    try {
      mkdirSync(archivePath, { recursive: true });
    } catch (e: unknown) {
      logError(MODULE, `Failed to create archive directory: ${ensureError(e).message}`);
      return 0;
    }
  }

  let movedCount = 0;
  const actionable = findings.filter((f) => f.category === 'root-noise' || f.category === 'misplaced-file');

  for (const finding of actionable) {
    if (!finding.path) continue;
    const oldPath = path.join(root, finding.path);
    const newPath = path.join(archivePath, finding.path);

    try {
      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath);
        logInfo(MODULE, `[ARCHIVE] Moved ${finding.path} to logs/archive/`);
        movedCount++;
      }
    } catch (e: unknown) {
      logError(MODULE, `Failed to archive ${finding.path}: ${ensureError(e).message}`);
    }
  }

  return movedCount;
}

// ── Core scan functions ───────────────────────────────────────────────────────

/**
 * Scans root directory for files not in the allowlist that look like noise/temp artefacts.
 */
function scanRootNoise(root: string): { findings: ProjectMaintainerFinding[]; suggestions: ProjectMaintainerSuggestion[] } {
  const findings: ProjectMaintainerFinding[] = [];
  const suggestions: ProjectMaintainerSuggestion[] = [];

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (error: unknown) {
    const err = ensureError(error);
    logWarn(MODULE, `Could not read root directory: ${err.message}`);
    return { findings, suggestions };
  }

  for (const name of entries) {
    const fullPath = path.join(root, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(MODULE, `Skipping root entry ${fullPath}: ${err.message}`);
      continue;
    }

    if (stat.isDirectory()) continue;
    if (ROOT_ALLOWLIST.has(name)) continue;

    if (isNoiseFile(name)) {
      findings.push({
        category: 'root-noise',
        severity: 'medium',
        message: `Artefakt fájl a root könyvtárban: ${name}`,
        path: name,
      });
      suggestions.push({
        action: 'review',
        target: name,
        reason: 'Ideiglenes / debug artefakt fájl a root könyvtárban. Emberi validáció után helyezd át vagy archiváld a dedikált mappába.',
      });
    } else {
      findings.push({
        category: 'misplaced-file',
        severity: 'low',
        message: `Ismeretlen fájl a root könyvtárban: ${name}`,
        path: name,
      });
      suggestions.push({
        action: 'review',
        target: name,
        reason: 'A fájl nincs az allowlistban. Ellenőrizd, hogy szükséges-e a root könyvtárban.',
      });
    }
  }

  return { findings, suggestions };
}

/**
 * Checks for unexpected top-level directories.
 */
function scanStructureDrift(root: string): { findings: ProjectMaintainerFinding[]; suggestions: ProjectMaintainerSuggestion[] } {
  const findings: ProjectMaintainerFinding[] = [];
  const suggestions: ProjectMaintainerSuggestion[] = [];

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (error: unknown) {
    const err = ensureError(error);
    logWarn(MODULE, `Could not read root entries for structure scan: ${err.message}`);
    return { findings, suggestions };
  }

  for (const name of entries) {
    const fullPath = path.join(root, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(MODULE, `Skipping top-level entry ${fullPath}: ${err.message}`);
      continue;
    }

    if (!stat.isDirectory()) continue;
    if (EXPECTED_TOP_DIRS.has(name)) continue;

    findings.push({
      category: 'structure-drift',
      severity: 'low',
      message: `Ismeretlen top-level könyvtár: ${name}`,
      path: name,
    });
    suggestions.push({
      action: 'review',
      target: name,
      reason: 'A könyvtár nincs az elfogadott top-level könyvtárak listájában. Ellenőrizd a rendeltetését.',
    });
  }

  return { findings, suggestions };
}

/**
 * Scans conductor tracks for missing spec.md / plan.md files.
 */
function scanConductorTracks(root: string): { findings: ProjectMaintainerFinding[]; suggestions: ProjectMaintainerSuggestion[]; trackSummary: TrackSummary } {
  const findings: ProjectMaintainerFinding[] = [];
  const suggestions: ProjectMaintainerSuggestion[] = [];
  const trackSummary: TrackSummary = {
    total: 0,
    missingSpec: [],
    missingPlan: [],
    healthy: 0,
  };

  const conductorPath = path.join(root, 'conductor', 'tracks');
  if (!existsSync(conductorPath)) {
    return { findings, suggestions, trackSummary };
  }

  let tracks: string[];
  try {
    tracks = readdirSync(conductorPath);
  } catch (error: unknown) {
    const err = ensureError(error);
    logWarn(MODULE, `Could not read conductor tracks: ${err.message}`);
    return { findings, suggestions, trackSummary };
  }

  for (const trackName of tracks) {
    const trackPath = path.join(conductorPath, trackName);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(trackPath);
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(MODULE, `Skipping track entry ${trackPath}: ${err.message}`);
      continue;
    }
    if (!stat.isDirectory()) continue;

    trackSummary.total++;
    let trackHealthy = true;

    const hasSpec = existsSync(path.join(trackPath, 'spec.md'));
    const hasPlan = existsSync(path.join(trackPath, 'plan.md'));

    if (!hasSpec) {
      trackSummary.missingSpec.push(trackName);
      trackHealthy = false;
      findings.push({
        category: 'track-anomaly',
        severity: 'medium',
        message: `Track hiányzó spec.md: ${trackName}`,
        path: `conductor/tracks/${trackName}`,
      });
      suggestions.push({
        action: 'create',
        target: `conductor/tracks/${trackName}/spec.md`,
        reason: 'Minden conductor track-nek rendelkeznie kell spec.md dokumentációval.',
      });
    }

    if (!hasPlan) {
      trackSummary.missingPlan.push(trackName);
      trackHealthy = false;
      findings.push({
        category: 'track-anomaly',
        severity: 'low',
        message: `Track hiányzó plan.md: ${trackName}`,
        path: `conductor/tracks/${trackName}`,
      });
      suggestions.push({
        action: 'create',
        target: `conductor/tracks/${trackName}/plan.md`,
        reason: 'Minden conductor track-nek rendelkeznie kell plan.md feladatkövetővel.',
      });
    }

    if (trackHealthy) {
      trackSummary.healthy++;
    }
  }

  return { findings, suggestions, trackSummary };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persists a report to the project_maintainer_reports table.
 * @param db - SQLite database instance
 * @param report - The report to persist
 */
function persistReport(db: Database.Database, report: ProjectMaintainerReport): void {
  try {
    db.prepare(`
      INSERT INTO project_maintainer_reports
        (id, generated_at, findings_count, suggestions_count, report_json, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.generatedAt,
      report.findings.length,
      report.suggestions.length,
      JSON.stringify(report),
      report.triggeredBy,
    );
    logInfo(MODULE, `🤖 [Brunella's Verdict]: Integrity check complete. ${report.findings.length} findings, ${report.suggestions.length} suggestions.`);
    logInfo(MODULE, 'System partner mission: Reliability and Transparency — Maintainer duty fulfilled.');
  } catch (error: unknown) {
    const err = ensureError(error);
    logError(MODULE, `Failed to persist report: ${err.message}`);
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs a non-destructive Project Maintainer report and persists the result.
 *
 * @param options.triggeredBy - Who triggered this run ('scheduler' | 'api' | 'cli')
 * @param options.dryRun - When true (default), no files are touched
 * @param options.db - Optional injected DB instance (used for testing)
 * @returns A fully populated ProjectMaintainerReport
 */
export async function runProjectMaintainerReport(options: {
  triggeredBy?: string;
  dryRun?: boolean;
  db?: Database.Database;
} = {}): Promise<ProjectMaintainerReport> {
  const { triggeredBy = 'api', dryRun = true } = options;
  const db = options.db ?? getGlobalDb();

  logInfo(MODULE, '🤖 Brunella Project Integrity Report — Start');
  logInfo(MODULE, `Starting maintenance scan (triggeredBy=${triggeredBy}, dryRun=${dryRun})`);

  const root = repoRoot();

  const rootNoise = scanRootNoise(root);
  const structureDrift = scanStructureDrift(root);
  const conductorScan = scanConductorTracks(root);

  const allFindings: ProjectMaintainerFinding[] = [
    ...rootNoise.findings,
    ...structureDrift.findings,
    ...conductorScan.findings,
  ];

  const allSuggestions: ProjectMaintainerSuggestion[] = [
    ...rootNoise.suggestions,
    ...structureDrift.suggestions,
    ...conductorScan.suggestions,
  ];

  if (!dryRun) {
    logWarn(MODULE, '⚠️ Active Maintenance Mode: Archiving noise files...');
    const archivedCount = archiveNoiseFiles(root, allFindings);
    logInfo(MODULE, `🚀 [ARCHIVE]: Finished moving ${archivedCount} artefacts to logs/archive/`);
  }

  const report: ProjectMaintainerReport = {
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    triggeredBy,
    findings: allFindings,
    suggestions: allSuggestions,
    trackSummary: conductorScan.trackSummary,
    dryRun,
  };

  persistReport(db, report);

  logInfo(MODULE, `🤖 [Brunella's Verdict]: Integrity check complete — Mission accomplished.`);

  return report;
}
