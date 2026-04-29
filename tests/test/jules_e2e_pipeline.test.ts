import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createScheduledTasksRoutes } from "@apps/mcp-core/server/routes/scheduledTasks.js";
import { createWebhookRoutes } from "@apps/mcp-core/server/routes/webhooks.js";
import { suggestedTasksRouter } from "@apps/mcp-core/server/routes/suggestedTasks.js";
import { initSuggestedTasksDb, getSuggestedTasksDb } from "@packages/core-logic/suggestedTasksScanner.js";
import { config } from "@packages/utils/schema.js";
import crypto from "crypto";

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return typeof entry === "string" ? entry : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return typeof entry === "number" ? entry : undefined;
}

function getBool(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return typeof entry === "boolean" ? entry : undefined;
}

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      handler TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      last_status TEXT DEFAULT 'pending',
      last_result TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      payload TEXT NOT NULL,
      processed BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function insertSuggestedTask(): void {
  const db = getSuggestedTasksDb();
  if (!db) {
    throw new Error("Suggested tasks DB not initialized");
  }

  db.prepare(`
    INSERT OR REPLACE INTO suggested_tasks (
      id, file_path, line_number, todo_text, context, confidence_score, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    "todo_test_file_1",
    "src/test/sample.ts",
    42,
    "TODO: E2E test item",
    "context line",
    0.8,
    "pending",
  );
}

function signGitHubPayload(payload: unknown): string {
  const secret = config.githubWebhookSecret ?? "test-secret";
  return `sha256=${crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
}

describe("Jules Continuous AI E2E flow", () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(async () => {
    db = createTestDb();
    await initSuggestedTasksDb(":memory:");

    app = express();
    app.use(express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }));
    app.use("/api/v1/scheduled-tasks", createScheduledTasksRoutes(db));
    app.use("/api/v1/webhooks", createWebhookRoutes(db));
    app.use("/api/v1/suggested-tasks", suggestedTasksRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  it("Scheduler E2E: create + trigger updates last_status", async () => {
    const createRes = await request(app)
      .post("/api/v1/scheduled-tasks")
      .send({
        title: "Nightly scan",
        prompt: "scan todos",
        cron_expression: "*/5 * * * *",
        handler: "scan-todos",
      });

    expect(createRes.status).toBe(201);
    const taskId = getString(createRes.body?.data, "id");
    expect(taskId).toBeDefined();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { count: 1, tasks: [] } }),
    } as FetchResponse as unknown as Response);

    const triggerRes = await request(app).post(`/api/v1/scheduled-tasks/${taskId}/trigger`);
    expect(triggerRes.status).toBe(200);

    const row = db.prepare("SELECT last_status, last_result FROM scheduled_tasks WHERE id = ?").get(taskId) as unknown;
    expect(getString(row, "last_status")).toBe("success");
    const lastResult = getString(row, "last_result");
    expect(lastResult).toBeDefined();

    if (lastResult) {
      const parsed = JSON.parse(lastResult) as unknown;
      expect(isRecord(parsed)).toBe(true);
      expect(getBool(parsed, "success")).toBe(true);
    }

    fetchSpy.mockRestore();
  });

  it("Webhook → scheduler: GitHub push triggers auto-scan hook", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { count: 0, tasks: [] } }),
    } as FetchResponse as unknown as Response);

    const payload = {
      repository: { name: "mcp-brunella-core" },
      pusher: { name: "tester" },
      ref: "refs/heads/main",
      head_commit: { id: "abc123" },
    };

    const res = await request(app)
      .post("/api/v1/webhooks/github/push")
      .set("X-Hub-Signature-256", signGitHubPayload(payload))
      .send(payload);

    expect(res.status).toBe(200);
    const event = db.prepare("SELECT * FROM webhook_events WHERE provider = ?").get("github") as unknown;
    expect(getString(event, "provider")).toBe("github");
    expect(getNumber(event, "processed")).toBe(1);

    fetchSpy.mockRestore();
  });

  it.skip("Render webhook imports Jules automations into scheduled tasks", async () => {
    const prevCwd = process.cwd();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jules-config-"));
    const configPath = path.join(tempDir, ".jules.yml");

    const config = [
      "version: '1.0'",
      "workflows: []",
      "automationRules:",
      "  - id: nightly-scan",
      "    name: Nightly Scan",
      "    trigger: schedule",
      "    schedule: '0 1 * * *'",
      "    enabled: true",
      "    actions:",
      "      - type: scheduled_task",
      "        target: scan-todos",
    ].join("\n");

    await fs.writeFile(configPath, config, "utf-8");
    process.chdir(tempDir);

    try {
      const res = await request(app).post("/api/v1/webhooks/render/deploy").send({});
      expect(res.status).toBe(200);

      const row = db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks").get() as unknown;
      expect(getNumber(row, "count")).toBe(1);
    } finally {
      process.chdir(prevCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("Full flow: webhook → scheduler trigger → dashboard data", async () => {
    const createRes = await request(app)
      .post("/api/v1/scheduled-tasks")
      .send({
        title: "Webhook scan",
        prompt: "scan todos",
        cron_expression: "*/5 * * * *",
        handler: "scan-todos",
      });

    const taskId = getString(createRes.body?.data, "id");
    expect(taskId).toBeDefined();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
      insertSuggestedTask();
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { count: 1, tasks: [{ id: "todo_test_file_1" }] } }),
      } as FetchResponse as unknown as Response;
    });

    const triggerRes = await request(app).post(`/api/v1/scheduled-tasks/${taskId}/trigger`);
    expect(triggerRes.status).toBe(200);

    const dashboardRes = await request(app).get("/api/v1/suggested-tasks");
    expect(dashboardRes.status).toBe(200);
    const tasks = isRecord(dashboardRes.body) ? dashboardRes.body.data : undefined;
    expect(Array.isArray(tasks), "Expected tasks array for dashboard view").toBe(true);
    if (Array.isArray(tasks)) {
      expect(tasks.length).toBeGreaterThan(0);
    }

    fetchSpy.mockRestore();
  });
});
