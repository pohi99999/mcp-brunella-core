import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createScheduledTasksRoutes } from "../src/server/routes/scheduledTasks.js";
import { createWebhookRoutes } from "../src/server/routes/webhooks.js";
import { suggestedTasksRouter } from "../src/server/routes/suggestedTasks.js";
import { initSuggestedTasksDb, getSuggestedTasksDb } from "../src/core/suggestedTasksScanner.js";
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function getString(value, key) {
    if (!isRecord(value))
        return undefined;
    const entry = value[key];
    return typeof entry === "string" ? entry : undefined;
}
function getNumber(value, key) {
    if (!isRecord(value))
        return undefined;
    const entry = value[key];
    return typeof entry === "number" ? entry : undefined;
}
function getBool(value, key) {
    if (!isRecord(value))
        return undefined;
    const entry = value[key];
    return typeof entry === "boolean" ? entry : undefined;
}
function createTestDb() {
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
function insertSuggestedTask() {
    const db = getSuggestedTasksDb();
    if (!db) {
        throw new Error("Suggested tasks DB not initialized");
    }
    db.prepare(`
    INSERT OR REPLACE INTO suggested_tasks (
      id, file_path, line_number, todo_text, context, confidence_score, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run("todo_test_file_1", "src/test/sample.ts", 42, "TODO: E2E test item", "context line", 0.8, "pending");
}
describe("Jules Continuous AI E2E flow", () => {
    let app;
    let db;
    beforeEach(async () => {
        db = createTestDb();
        await initSuggestedTasksDb(":memory:");
        app = express();
        app.use(express.json());
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
        });
        const triggerRes = await request(app).post(`/api/v1/scheduled-tasks/${taskId}/trigger`);
        expect(triggerRes.status).toBe(200);
        const row = db.prepare("SELECT last_status, last_result FROM scheduled_tasks WHERE id = ?").get(taskId);
        expect(getString(row, "last_status")).toBe("success");
        const lastResult = getString(row, "last_result");
        expect(lastResult).toBeDefined();
        if (lastResult) {
            const parsed = JSON.parse(lastResult);
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
        });
        const res = await request(app)
            .post("/api/v1/webhooks/github/push")
            .send({
            repository: { name: "mcp-brunella-core" },
            pusher: { name: "tester" },
            ref: "refs/heads/main",
            head_commit: { id: "abc123" },
        });
        expect(res.status).toBe(200);
        const event = db.prepare("SELECT * FROM webhook_events WHERE provider = ?").get("github");
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
            const row = db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks").get();
            expect(getNumber(row, "count")).toBe(1);
        }
        finally {
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
            };
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
