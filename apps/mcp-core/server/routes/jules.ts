import { Router } from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { logError, logInfo, logWarn, logDebug } from "@packages/utils/logger.js";
import { getGlobalDb } from "@packages/utils/globalDb.js";
import { JulesAutomationService } from "@packages/core-logic/julesAutomationService.js";
import { ensureError } from "@packages/utils/ensureError.js";

interface GithubApiError extends Error {
  statusCode?: number;
  data?: unknown;
}

// Helper to run shell commands
const runCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logError("JulesRoutes", `Exec error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr && !stderr.includes("Created session")) {
        // Jules CLI might print info to stderr
        logWarn("JulesRoutes", `Stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
};

function getGithubApiBase(): string {
  return process.env.GITHUB_API_BASE || "https://api.github.com";
}

function getGithubRepo(): string {
  // Prefer GitHub Actions env, then local .env, then repo default.
  return (
    process.env.GITHUB_REPOSITORY ||
    process.env.GITHUB_REPO ||
    "pohi99999/mcp-brunella-core"
  );
}

function getGithubToken(): string | undefined {
  return (
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT
  );
}

async function githubFetchJson(url: string, init?: RequestInit): Promise<any> {
  const token = getGithubToken();
  if (!token) {
    const err = new Error("GitHub token missing (set GITHUB_TOKEN)") as GithubApiError;
    err.statusCode = 503;
    throw err;
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch (error: unknown) {
          logDebug("JulesRoutes", `GitHub API response parse fallback: ${ensureError(error).message}`);
          return { raw: text };
        }
      })()
    : {};

  if (!response.ok) {
    const err = new Error(
      data && (data.message as string)
        ? `GitHub API error: ${data.message}`
        : `GitHub API error: HTTP ${response.status}`,
    ) as GithubApiError;
    err.statusCode = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getHttpStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && Number.isFinite(statusCode)) {
      return statusCode;
    }
  }

  return 500;
}

export function createJulesRoutes(): Router {
  const router = Router();
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "jules_cli_wrapper.py",
  );

  // ------------------------------------------------------------------------
  // GitHub Actions (Async tests)
  // ------------------------------------------------------------------------

  // GET /workflow-runs?workflow=jules-async-tests.yml&limit=10
  router.get("/workflow-runs", async (req, res) => {
    try {
      const workflow =
        typeof req.query.workflow === "string" && req.query.workflow.trim()
          ? req.query.workflow.trim()
          : "jules-async-tests.yml";

      const limitRaw =
        typeof req.query.limit === "string" ? req.query.limit : "10";
      const limit = Math.max(
        1,
        Math.min(50, parseInt(limitRaw || "10", 10) || 10),
      );

      const repo = getGithubRepo();
      const base = getGithubApiBase();
      const url = `${base}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${limit}`;

      const data = await githubFetchJson(url);
      res.json({ workflow, runs: data.workflow_runs || [] });
    } catch (e: unknown) {
      const msg = ensureError(e).message;
      const status = getHttpStatus(e);
      res.status(status).json({ error: msg });
    }
  });

  // POST /dispatch { workflow?: string, ref?: string, inputs?: object }
  router.post("/dispatch", async (req, res) => {
    try {
      const workflow =
        typeof req.body?.workflow === "string" && req.body.workflow.trim()
          ? String(req.body.workflow).trim()
          : "jules-async-tests.yml";

      const ref =
        typeof req.body?.ref === "string" && req.body.ref.trim()
          ? String(req.body.ref).trim()
          : "main";

      const inputs = (req.body?.inputs ?? {}) as Record<string, unknown>;

      const repo = getGithubRepo();
      const base = getGithubApiBase();
      const url = `${base}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

      logInfo("JulesRoutes", `Dispatch workflow: ${workflow} ref=${ref}`);

      await githubFetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, inputs }),
      });

      res.json({ success: true, workflow, ref });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      const status = typeof e === "object" && e !== null && "statusCode" in e
        ? Number((e as { statusCode?: unknown }).statusCode) || 500
        : 500;
      logError("JulesRoutes", `Workflow dispatch failed: ${normalized.message}`, normalized);
      res.status(status).json({ error: normalized.message });
    }
  });

  // GET /sessions - List all sessions
  router.get("/sessions", async (req, res) => {
    try {
      // Using the wrapper to list sessions.
      // Expecting JSON output or parsing text if wrapper doesn't support JSON flag yet.
      // Ideally assume wrapper outputs something parseable or we parse it here.
      // Let's assume the wrapper output is human readable for now and we send it raw
      // or we try to parse it if we can.

      // For now, let's just send the raw output or a mocked list if script fails
      const stdout = await runCommand(`python "${scriptPath}" list`);

      // Parse stdout to JSON if possible, otherwise return as raw text lines
      const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
      const sessions = lines.map((line) => {
        // Simple parser attempt: "SessionID Status Task..."
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          return {
            id: parts[0],
            status: parts[1],
            task: parts.slice(2).join(" "),
          };
        }
        return { id: "unknown", status: "unknown", task: line };
      });

      res.json({ sessions });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError("JulesRoutes", `Session listing failed: ${normalized.message}`, normalized);
      res.status(500).json({ error: normalized.message });
    }
  });

  // POST /task - Create new task
  router.post("/task", async (req, res) => {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: "Task is required" });
    }

    try {
      // Escape quotes in task to prevent shell injection issues (basic)
      const safeTask = task.replace(/"/g, '\\"');
      const stdout = await runCommand(
        `python "${scriptPath}" new "${safeTask}"`,
      );

      // Extract Session ID from output
      // Output example: "✅ Session created: 12345..."
      const match =
        stdout.match(/Session ID: (\d+)/) ||
        stdout.match(/Session created: (\d+)/);
      const sessionId = match ? match[1] : null;

      res.json({
        success: true,
        sessionId,
        output: stdout,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError("JulesRoutes", `Task creation failed: ${normalized.message}`, normalized);
      res.status(500).json({ error: normalized.message });
    }
  });

  // POST /sync - Sync/Pull a session
  router.post("/sync", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    try {
      const stdout = await runCommand(
        `python "${scriptPath}" pull "${sessionId}"`,
      );
      res.json({ success: true, output: stdout });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError("JulesRoutes", `Session sync failed: ${normalized.message}`, normalized);
      res.status(500).json({ error: normalized.message });
    }
  });

  // ------------------------------------------------------------------------
  // Jules automation rules (.jules.yml) -> scheduled_tasks
  // ------------------------------------------------------------------------

  // GET /automations/tasks - list imported Jules tasks
  router.get("/automations/tasks", async (_req, res) => {
    try {
      const db = getGlobalDb();
      const julesService = new JulesAutomationService(db);
      const tasks = julesService.getImportedTasks();
      res.json({ success: true, count: tasks.length, tasks });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logError("JulesRoutes", `Automation task listing failed: ${normalized.message}`, normalized);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  // POST /automations/import - manually trigger import from .jules.yml
  router.post("/automations/import", async (req, res) => {
    try {
      const skipIfExists =
        typeof req.body?.skipIfExists === "boolean" ? req.body.skipIfExists : true;
      const enableImmediately =
        typeof req.body?.enableImmediately === "boolean"
          ? req.body.enableImmediately
          : true;

      const db = getGlobalDb();
      const julesService = new JulesAutomationService(db);
      const result = await julesService.importJulesAutomations({
        skipIfExists,
        enableImmediately,
      });

      res.json({ success: true, result });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logError("JulesRoutes", `Automation import failed: ${normalized.message}`, normalized);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  return router;
}
